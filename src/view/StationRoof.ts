import type * as Model from '../model';
import type { Vec2 } from '../types';

const RAY_COUNT = 360;
const SUBDIVISION = 3;
const STEP_FRACTION = 0.5;

export interface DarknessPaths {
  black: Vec2[][];
  dim: Vec2[][];
}

interface FineGrid {
  size: number;
  count: number;
  half: number;
  carved: Uint8Array;
  key: (fc: number, fr: number) => string;
  centerLocal: (fc: number, fr: number) => Vec2;
  toCell: (local: Vec2) => { fc: number; fr: number };
  inBounds: (fc: number, fr: number) => boolean;
}

// Tracks which interior fine cells the ship has revealed by line of sight (REQ-86)
// and provides the darkness geometry for the lamp's unified offscreen pass:
// unrevealed carved cells become near-black, revealed cells become dim. Rendering
// itself lives in StationLamp so darkness and light share one multiply composite
// and diagonal gates get smooth darkness instead of coarse black squares.
export class StationRoof {
  private stationId = '';
  private fine: FineGrid | null = null;
  private readonly revealedCells = new Set<string>();
  private lastCoarseKey = '';
  private lastGateKey = '';
  private revealedVersion = 0;
  private darknessCacheKey = '';
  private cachedDarkness: DarknessPaths = { black: [], dim: [] };

  reset(): void {
    this.stationId = '';
    this.revealedCells.clear();
    this.lastCoarseKey = '';
    this.lastGateKey = '';
    this.revealedVersion = 0;
    this.darknessCacheKey = '';
    this.cachedDarkness = { black: [], dim: [] };
    this.fine = null;
  }

  // Advance reveal tracking for the ship's current position. Call once per frame
  // before reading darkness paths or reveal state.
  update(station: Model.Station, shipPosition: Vec2): void {
    if (!station.isPlaced) return;
    this.ensureStation(station);
    this.updateRevealed(station, shipPosition);
  }

  isRevealedAt(station: Model.Station, worldPoint: Vec2): boolean {
    const fine = this.fine;
    const carver = station.carver;
    if (!fine || !carver) return false;
    const local = carver.worldToLocal(worldPoint, station.center!, station.entranceAngle);
    const cell = fine.toCell(local);
    if (!fine.inBounds(cell.fc, cell.fr)) return false;
    return this.revealedCells.has(fine.key(cell.fc, cell.fr));
  }

  // World-space fine-cell quads split into unrevealed (black) and revealed (dim),
  // cached per reveal version so it is only rebuilt when the ship reveals new area.
  computeDarknessPaths(station: Model.Station): DarknessPaths {
    const key = `${this.stationId}:${this.revealedVersion}`;
    if (key === this.darknessCacheKey) return this.cachedDarkness;
    this.darknessCacheKey = key;
    this.cachedDarkness = this.buildDarknessPaths(station);
    return this.cachedDarkness;
  }

  private ensureStation(station: Model.Station): void {
    const center = station.center!;
    const id = `${center.x}:${center.y}:${station.outerRadius}:${station.entranceAngle}`;
    if (id === this.stationId) return;
    this.stationId = id;
    this.revealedCells.clear();
    this.lastCoarseKey = '';
    this.lastGateKey = '';
    this.revealedVersion = 0;
    this.darknessCacheKey = '';
    this.cachedDarkness = { black: [], dim: [] };
    this.fine = this.buildFineGrid(station);
    for (const k of this.roomFineCells(station, 'entrance')) this.revealedCells.add(k);
    this.revealedVersion++;
  }

  private buildFineGrid(station: Model.Station): FineGrid {
    const carver = station.carver!;
    const sub = SUBDIVISION;
    const size = carver.cellSize / sub;
    const count = carver.gridN * sub;
    const half = count / 2;
    const carved = new Uint8Array(count * count);
    for (let fr = 0; fr < count; fr++) {
      for (let fc = 0; fc < count; fc++) {
        const cc = Math.floor(fc / sub);
        const cr = Math.floor(fr / sub);
        carved[fr * count + fc] = carver.bitmap[cr * carver.gridN + cc];
      }
    }
    return {
      size,
      count,
      half,
      carved,
      key: (fc, fr) => `${fc},${fr}`,
      centerLocal: (fc, fr) => ({ x: (fc - half + 0.5) * size, y: (fr - half + 0.5) * size }),
      toCell: (local) => ({ fc: Math.floor(local.x / size + half), fr: Math.floor(local.y / size + half) }),
      inBounds: (fc, fr) => fc >= 0 && fr >= 0 && fc < count && fr < count,
    };
  }

  private updateRevealed(station: Model.Station, shipPosition: Vec2): void {
    const fine = this.fine;
    const carver = station.carver;
    if (!fine || !carver) return;
    const center = station.center!;
    const rotation = station.entranceAngle;
    const local = carver.worldToLocal(shipPosition, center, rotation);
    const coarse = carver.localToCell(local);
    const coarseInBounds = carver.inBounds(coarse.c, coarse.r);
    const coarseKey = coarseInBounds ? `${coarse.c},${coarse.r}` : 'out';
    const gateKey = `${station.isGateOpen(1)}:${station.isGateOpen(2)}:${station.isGateOpen(3)}`;
    if (coarseKey === this.lastCoarseKey && gateKey === this.lastGateKey) return;
    this.lastCoarseKey = coarseKey;
    this.lastGateKey = gateKey;
    const fineCell = fine.toCell(local);
    if (!fine.inBounds(fineCell.fc, fineCell.fr) || fine.carved[fineCell.fr * fine.count + fineCell.fc] !== 1) return;
    const blockers = this.closedGateFineCells(station);
    this.castLineOfSight(fine, local, blockers);
  }

  private closedGateFineCells(station: Model.Station): Set<string> {
    const fine = this.fine!;
    const sub = SUBDIVISION;
    const blockers = new Set<string>();
    for (let i = 1; i <= 3; i++) {
      if (station.isGateOpen(i)) continue;
      for (const g of station.gateCells(i)) {
        for (let sr = 0; sr < sub; sr++) {
          for (let sc = 0; sc < sub; sc++) {
            blockers.add(fine.key(g.c * sub + sc, g.r * sub + sr));
          }
        }
      }
    }
    return blockers;
  }

  private castLineOfSight(fine: FineGrid, origin: Vec2, blockers: Set<string>): void {
    const maxDist = fine.size * fine.count;
    const step = fine.size * STEP_FRACTION;
    for (let i = 0; i < RAY_COUNT; i++) {
      const angle = (i / RAY_COUNT) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let dist = 0;
      while (dist <= maxDist) {
        const x = origin.x + dx * dist;
        const y = origin.y + dy * dist;
        const cell = fine.toCell({ x, y });
        if (!fine.inBounds(cell.fc, cell.fr)) break;
        if (fine.carved[cell.fr * fine.count + cell.fc] !== 1) break;
        const k = fine.key(cell.fc, cell.fr);
        if (!this.revealedCells.has(k)) { this.revealedCells.add(k); this.revealedVersion++; }
        if (blockers.has(k)) break;
        dist += step;
      }
    }
  }

  private buildDarknessPaths(station: Model.Station): DarknessPaths {
    const fine = this.fine!;
    const carver = station.carver!;
    const center = station.center!;
    const rotation = station.entranceAngle;
    const sub = SUBDIVISION;
    const n = carver.gridN;
    const coarseHalf = carver.cellSize / 2 + 0.5;
    const fineHalf = fine.size / 2 + 0.25;
    const black: Vec2[][] = [];
    const dim: Vec2[][] = [];
    // Iterate coarse cells (~10k, not ~90k fine cells): emit one big quad for
    // fully-uniform coarse cells, and only fall back to fine sub-cells for the
    // partial frontier. Keeps fillPolygons subpath count low for performance.
    for (let cr = 0; cr < n; cr++) {
      for (let cc = 0; cc < n; cc++) {
        if (carver.bitmap[cr * n + cc] !== 1) continue;
        let revealedCount = 0;
        for (let sr = 0; sr < sub; sr++) {
          for (let sc = 0; sc < sub; sc++) {
            if (this.revealedCells.has(fine.key(cc * sub + sc, cr * sub + sr))) revealedCount++;
          }
        }
        const total = sub * sub;
        if (revealedCount === 0) {
          const local = carver.cellCenterLocal(cc, cr);
          const corners: Vec2[] = [
            { x: local.x - coarseHalf, y: local.y - coarseHalf },
            { x: local.x + coarseHalf, y: local.y - coarseHalf },
            { x: local.x + coarseHalf, y: local.y + coarseHalf },
            { x: local.x - coarseHalf, y: local.y + coarseHalf },
          ];
          black.push(corners.map((p) => carver.localToWorld(p, center, rotation)));
        } else if (revealedCount === total) {
          const local = carver.cellCenterLocal(cc, cr);
          const corners: Vec2[] = [
            { x: local.x - coarseHalf, y: local.y - coarseHalf },
            { x: local.x + coarseHalf, y: local.y - coarseHalf },
            { x: local.x + coarseHalf, y: local.y + coarseHalf },
            { x: local.x - coarseHalf, y: local.y + coarseHalf },
          ];
          dim.push(corners.map((p) => carver.localToWorld(p, center, rotation)));
        } else {
          for (let sr = 0; sr < sub; sr++) {
            for (let sc = 0; sc < sub; sc++) {
              const fc = cc * sub + sc;
              const fr = cr * sub + sr;
              const local = fine.centerLocal(fc, fr);
              const corners: Vec2[] = [
                { x: local.x - fineHalf, y: local.y - fineHalf },
                { x: local.x + fineHalf, y: local.y - fineHalf },
                { x: local.x + fineHalf, y: local.y + fineHalf },
                { x: local.x - fineHalf, y: local.y + fineHalf },
              ];
              const world = corners.map((p) => carver.localToWorld(p, center, rotation));
              if (this.revealedCells.has(fine.key(fc, fr))) dim.push(world);
              else black.push(world);
            }
          }
        }
      }
    }
    return { black, dim };
  }

  private roomFineCells(station: Model.Station, kind: string): string[] {
    const fine = this.fine!;
    const carver = station.carver!;
    const center = station.center!;
    const rotation = station.entranceAngle;
    const room = station.rooms.find((r) => r.kind === kind);
    if (!room) return [];
    const local = carver.worldToLocal(room.position, center, rotation);
    const keys: string[] = [];
    for (let fr = 0; fr < fine.count; fr++) {
      for (let fc = 0; fc < fine.count; fc++) {
        if (fine.carved[fr * fine.count + fc] !== 1) continue;
        const cl = fine.centerLocal(fc, fr);
        if (Math.abs(cl.x - local.x) <= room.halfWidth && Math.abs(cl.y - local.y) <= room.halfHeight) {
          keys.push(fine.key(fc, fr));
        }
      }
    }
    return keys;
  }
}
