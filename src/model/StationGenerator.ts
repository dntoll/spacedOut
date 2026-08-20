import { length, normalize, sub } from '../math';
import type { Vec2 } from '../types';
import { RandomSequence } from './RandomSequence';
import { StationCarver, type BoundarySegment } from './StationCarver';
import { StationGate } from './StationGate';
import { StationMachinery } from './StationMachinery';
import { StationSwitch } from './StationSwitch';
import { StationWall } from './StationWall';
import { SupplyType } from './SupplyChooser';

export interface StationCollectibleSpec {
  position: Vec2;
  type: SupplyType;
}

export type RoomKind = 'entrance' | 'area' | 'switch' | 'central' | 'extra';

export interface StationRoomInstance {
  id: string;
  kind: RoomKind;
  index: number;
  position: Vec2;
  halfWidth: number;
  halfHeight: number;
}

export interface StationLayout {
  center: Vec2;
  outerRadius: number;
  entrancePosition: Vec2;
  entranceAngle: number;
  entranceRadius: number;
  centralCenter: Vec2;
  centralRadius: number;
  exteriorWalls: StationWall[];
  interiorWalls: StationWall[];
  gates: StationGate[];
  switches: StationSwitch[];
  machinery: StationMachinery[];
  collectibles: StationCollectibleSpec[];
  carver: StationCarver;
  rooms: StationRoomInstance[];
  switchRoomIds: string[];
  gateCells: { c: number; r: number }[][];
  switchCells: { c: number; r: number }[];
  entranceCell: { c: number; r: number };
  centralCell: { c: number; r: number };
}

const CELL_SIZE = 60;
const WALL_HALF_FRACTION = 0.012;
const CORRIDOR_HALF_FRACTION = 0.07;
const SWITCH_RADIUS = 26;
const SHIP_RADIUS = 18;
const MACHINERY_RADIUS_FRACTION = 0.014;
const MACHINERY_BLOCK_MARGIN = 6;
const PLACE_RETRIES = 80;
const SECTION_BRANCHES = 10;
const SECTION_CROSS_LINKS = 4;
const SECTION_RADIUS_FRACTION = 0.28;
const BRANCH_HW_FRACTION = 0.042;
const CORRIDOR_LEN_FRACTION = 0.05;
const BRANCH_KEEP_OUT_FRACTION = 0.88;
const SECTION_SAMPLE_RETRIES = 200;
const GENERATION_RETRIES = 16;

interface RoomPlacement {
  id: string;
  kind: RoomKind;
  index: number;
  local: Vec2;
  hw: number;
  hh: number;
}

// The station is divided into four gated sections chained entrance -> central:
//   A (entrance + switch 1) --gate 1--> B (switch 2) --gate 2--> C (switch 3) --gate 3--> D (central)
// Per REQ-80, switch i is reachable only after gate i-1 opens, and the central chamber
// only after gate 3. Sections are placed at randomized anchors forming a non-self-
// intersecting path, separated by solid rock so the gate corridor is the only connection
// between adjacent sections. Each section grows a randomized looped maze of branch rooms
// and cross-link corridors confined to a disc around its hub.

export class StationGenerator {
  static generate(center: Vec2, outerRadius: number, entranceAngle: number, seed: number): StationLayout {
    for (let attempt = 0; attempt < GENERATION_RETRIES; attempt++) {
      const layout = this.tryGenerate(center, outerRadius, entranceAngle, (seed + attempt) >>> 0);
      if (layout) return layout;
    }
    throw new Error('station generation failed: could not satisfy gating invariants');
  }

  private static tryGenerate(center: Vec2, outerRadius: number, entranceAngle: number, seed: number): StationLayout | null {
    const random = new RandomSequence(seed >>> 0);
    const carver = new StationCarver(outerRadius, CELL_SIZE);
    const wallHalf = outerRadius * WALL_HALF_FRACTION;
    const corridorHalf = outerRadius * CORRIDOR_HALF_FRACTION;
    const R = outerRadius;
    const sectionRadius = R * SECTION_RADIUS_FRACTION;
    const branchHwBase = R * BRANCH_HW_FRACTION;
    const corridorLen = R * CORRIDOR_LEN_FRACTION;
    const keepOut = R * BRANCH_KEEP_OUT_FRACTION;
    const jitter = (n: number): number => random.between(-n, n);
    const localToWorld = (local: Vec2): Vec2 => carver.localToWorld(local, center, entranceAngle);

    const placements = new Map<string, RoomPlacement>();
    const sectionRooms: RoomPlacement[][] = [[], [], [], []];
    const place = (id: string, kind: RoomKind, index: number, local: Vec2, hw: number, hh: number, section: number): RoomPlacement => {
      const p: RoomPlacement = { id, kind, index, local: { ...local }, hw, hh };
      placements.set(id, p);
      sectionRooms[section].push(p);
      return p;
    };

    // --- Section anchors -----------------------------------------------------
    const A: Vec2 = { x: R * 0.95, y: 0 };
    const D: Vec2 = { x: 0, y: 0 };
    const sampled = this.sampleSections(random, A, D, R, keepOut);
    if (!sampled) return null;
    const { B, C } = sampled;
    const anchors: Vec2[] = [A, B, C, D];

    // --- Hub rooms -----------------------------------------------------------
    carver.carveRectRoom(A, R * 0.06, R * 0.08, R * 0.004);
    place('entrance', 'entrance', 0, A, R * 0.06, R * 0.08, 0);
    carver.carveRectRoom(B, R * 0.08, R * 0.10, R * 0.004);
    place('area1', 'area', 1, B, R * 0.08, R * 0.10, 1);
    carver.carveRectRoom(C, R * 0.08, R * 0.10, R * 0.004);
    place('area2', 'area', 2, C, R * 0.08, R * 0.10, 2);
    carver.carveRectRoom(D, R * 0.12, R * 0.14, R * 0.004);
    place('central', 'central', 0, D, R * 0.12, R * 0.14, 3);

    // --- Per-section internal maze ------------------------------------------
    const tryPlaceBranch = (parentIds: string[], hubLocal: Vec2, id: string, kind: RoomKind, index: number, section: number): string | null => {
      for (let attempt = 0; attempt < PLACE_RETRIES; attempt++) {
        const parentId = parentIds[random.integer(0, parentIds.length)];
        const parent = placements.get(parentId)!;
        const hw = branchHwBase * random.between(0.85, 1.35);
        const hh = branchHwBase * random.between(0.85, 1.35);
        const angle = random.between(0, Math.PI * 2);
        const dist = Math.max(parent.hw, parent.hh) + Math.max(hw, hh) + corridorLen;
        const local: Vec2 = { x: parent.local.x + Math.cos(angle) * dist, y: parent.local.y + Math.sin(angle) * dist };
        if (length(sub(local, hubLocal)) + Math.max(hw, hh) > sectionRadius) continue;
        if (Math.hypot(local.x, local.y) + Math.max(hw, hh) > keepOut) continue;
        if (!carver.fitsRect(local, hw, hh)) continue;
        carver.carveRectRoom(local, hw, hh, R * 0.003);
        carver.carveRectCorridor(parent.local, local, corridorHalf);
        place(id, kind, index, local, hw, hh, section);
        return id;
      }
      return null;
    };

    const switchRoomPlacement: (RoomPlacement | null)[] = [null, null, null];
    for (let s = 0; s < 4; s++) {
      const hub = sectionRooms[s][0];
      const parents: string[] = [hub.id];
      for (let b = 0; b < SECTION_BRANCHES; b++) {
        const id = `s${s}b${b}`;
        if (tryPlaceBranch(parents, hub.local, id, 'extra', 0, s)) parents.push(id);
      }
      if (s < 3) {
        const sid = `switch${s + 1}`;
        if (tryPlaceBranch(parents, hub.local, sid, 'switch', s + 1, s)) {
          switchRoomPlacement[s] = placements.get(sid)!;
        }
      }
      // Cross-link corridors create loops within the section so corridors lead
      // between its rooms rather than only dead-ending off the hub.
      const rooms = sectionRooms[s];
      if (rooms.length >= 2) {
        for (let k = 0; k < SECTION_CROSS_LINKS; k++) {
          const i1 = random.integer(0, rooms.length);
          let i2 = random.integer(0, rooms.length);
          if (i2 === i1) i2 = (i2 + 1) % rooms.length;
          const r1 = rooms[i1];
          const r2 = rooms[i2];
          if (length(sub(r1.local, r2.local)) < sectionRadius * 1.8) {
            carver.carveRectCorridor(r1.local, r2.local, corridorHalf);
          }
        }
      }
    }

    // Central annex rooms carry collectibles.
    const centralParents = [...sectionRooms[3].map((p) => p.id)];
    for (const id of ['cab0', 'cab1']) {
      if (tryPlaceBranch(centralParents, D, id, 'extra', 0, 3)) centralParents.push(id);
    }

    // Switches that failed to get a dedicated room fall back into their hub room.
    for (let s = 0; s < 3; s++) {
      if (!switchRoomPlacement[s]) switchRoomPlacement[s] = sectionRooms[s][0];
    }

    // --- Gate corridors (the only inter-section connections) -----------------
    const gateCells: { c: number; r: number }[][] = [[], [], []];
    const gates: StationGate[] = [];
    for (let i = 0; i < 3; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      carver.carveRectCorridor(a, b, corridorHalf);
      const mid: Vec2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gateCells[i] = this.gateSlabCells(carver, a, b, mid, corridorHalf, wallHalf);
      const dir = normalize(sub(b, a));
      const perp: Vec2 = { x: -dir.y, y: dir.x };
      const gateHalf = corridorHalf + wallHalf;
      const gateAngle = Math.atan2(perp.y, perp.x);
      gates.push(new StationGate(i + 1, localToWorld(mid), gateAngle, gateHalf, wallHalf));
    }

    // --- Switches ------------------------------------------------------------
    const switchCells: { c: number; r: number }[] = [];
    const switches: StationSwitch[] = [];
    for (let s = 0; s < 3; s++) {
      const room = switchRoomPlacement[s]!;
      const local: Vec2 = { x: room.local.x + jitter(room.hw * 0.4), y: room.local.y + jitter(room.hh * 0.4) };
      switches.push(new StationSwitch(s + 1, localToWorld(local), SWITCH_RADIUS));
      switchCells.push(carver.localToCell(local));
    }

    const entranceCell = carver.localToCell(A);
    const centralCell = carver.localToCell(D);

    // Verify the REQ-80 gating invariants hold with no machinery: each section is
    // reachable only after its gate opens. If a accidental adjacency leaked between
    // sections, reject this seed and retry.
    if (!this.preservesReachability(carver, entranceCell, gateCells, switchCells, centralCell, [], 0)) return null;

    // --- Machinery (smaller pillars, never blocking the critical path) -------
    const machineryRadius = R * MACHINERY_RADIUS_FRACTION;
    const machineryCandidates: Vec2[] = [];
    for (const p of placements.values()) {
      if (p.kind === 'entrance') continue;
      machineryCandidates.push({ x: p.local.x + jitter(p.hw * 0.25), y: p.local.y + jitter(p.hh * 0.25) });
    }
    for (let i = machineryCandidates.length - 1; i > 0; i--) {
      const j = random.integer(0, i + 1);
      [machineryCandidates[i], machineryCandidates[j]] = [machineryCandidates[j], machineryCandidates[i]];
    }
    const acceptedMachinery: Vec2[] = [];
    for (const candidate of machineryCandidates) {
      const trial = [...acceptedMachinery, candidate];
      if (this.preservesReachability(carver, entranceCell, gateCells, switchCells, centralCell, trial, machineryRadius)) {
        acceptedMachinery.push(candidate);
      }
    }
    const machinery: StationMachinery[] = acceptedMachinery.map((local) =>
      new StationMachinery(localToWorld(local), machineryRadius, random.between(0, Math.PI * 2), random.integer(0, 4)));

    // --- Collectibles --------------------------------------------------------
    const sw1 = placements.get('switch1') ?? sectionRooms[0][0];
    const sw2 = placements.get('switch2') ?? sectionRooms[1][0];
    const sw3 = placements.get('switch3') ?? sectionRooms[2][0];
    const cab0 = placements.get('cab0');
    const cab1 = placements.get('cab1');
    const centralPlacement = placements.get('central')!;
    const collectibles: StationCollectibleSpec[] = [
      { position: localToWorld(this.roomJitter(sw1, jitter)), type: SupplyType.Fuel },
      { position: localToWorld(this.roomJitter(sw2, jitter)), type: SupplyType.Ammo },
      { position: localToWorld(this.roomJitter(sw3, jitter)), type: SupplyType.Hp },
      { position: localToWorld(this.roomJitter(cab0 ?? centralPlacement, jitter)), type: SupplyType.Ammo },
      { position: localToWorld(this.roomJitter(cab1 ?? centralPlacement, jitter)), type: SupplyType.Fuel },
      { position: localToWorld({ ...centralPlacement.local }), type: SupplyType.Hp },
    ];

    // --- Walls ---------------------------------------------------------------
    const boundary = carver.traceBoundary();
    const walls: StationWall[] = boundary.map((seg) => this.wallFromSegment(seg, center, entranceAngle, wallHalf, carver));
    const exteriorWalls: StationWall[] = [];
    const interiorWalls: StationWall[] = [];
    for (const wall of walls) {
      const d = Math.hypot(wall.position.x - center.x, wall.position.y - center.y);
      if (d > outerRadius * 0.7) exteriorWalls.push(wall);
      else interiorWalls.push(wall);
    }

    const rooms: StationRoomInstance[] = [...placements.values()].map((p) => ({
      id: p.id,
      kind: p.kind,
      index: p.index,
      position: localToWorld(p.local),
      halfWidth: p.hw,
      halfHeight: p.hh,
    }));

    return {
      center,
      outerRadius,
      entrancePosition: localToWorld({ x: outerRadius, y: 0 }),
      entranceAngle,
      entranceRadius: placements.get('entrance')!.hh,
      centralCenter: localToWorld(centralPlacement.local),
      centralRadius: centralPlacement.hw,
      exteriorWalls,
      interiorWalls,
      gates,
      switches,
      machinery,
      collectibles,
      carver,
      rooms,
      switchRoomIds: ['switch1', 'switch2', 'switch3'],
      gateCells,
      switchCells,
      entranceCell,
      centralCell,
    };
  }

  private static sampleSections(random: RandomSequence, A: Vec2, D: Vec2, R: number, keepOut: number): { B: Vec2; C: Vec2 } | null {
    for (let attempt = 0; attempt < SECTION_SAMPLE_RETRIES; attempt++) {
      const rB = random.between(0.62, 0.82) * R;
      const tB = random.between(0, Math.PI * 2);
      const B: Vec2 = { x: Math.cos(tB) * rB, y: Math.sin(tB) * rB };
      if (length(sub(B, A)) < 0.72 * R || length(sub(B, A)) > 0.95 * R) continue;
      const rC = random.between(0.62, 0.82) * R;
      const tC = random.between(0, Math.PI * 2);
      const C: Vec2 = { x: Math.cos(tC) * rC, y: Math.sin(tC) * rC };
      if (length(sub(C, D)) < 0.62 * R || length(sub(C, D)) > 0.82 * R) continue;
      if (length(sub(C, B)) < 0.72 * R || length(sub(C, B)) > 1.0 * R) continue;
      if (length(sub(C, A)) < 0.6 * R) continue;
      if (Math.hypot(C.x, C.y) > keepOut) continue;
      // The path A->B->C->D must not self-intersect: only A-B and C-D can cross.
      if (this.segmentsCross(A, B, C, D)) continue;
      return { B, C };
    }
    return null;
  }

  private static segmentsCross(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
    const d1 = this.cross(p3, p4, p1);
    const d2 = this.cross(p3, p4, p2);
    const d3 = this.cross(p1, p2, p3);
    const d4 = this.cross(p1, p2, p4);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    return false;
  }

  private static cross(a: Vec2, b: Vec2, c: Vec2): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  // Cells of the gate corridor's cross-section at its midpoint. A closed gate
  // blocks exactly these cells, and since the gate corridor is the only carved
  // connection between two sections, closing it fully separates them (REQ-80).
  private static gateSlabCells(
    carver: StationCarver,
    a: Vec2,
    b: Vec2,
    mid: Vec2,
    corridorHalf: number,
    wallHalf: number,
  ): { c: number; r: number }[] {
    const dir = normalize(sub(b, a));
    const perp: Vec2 = { x: -dir.y, y: dir.x };
    const alongHalf = wallHalf + carver.cellSize;
    const perpHalf = corridorHalf + carver.cellSize;
    const midCell = carver.localToCell(mid);
    const range = Math.ceil((alongHalf + perpHalf) / carver.cellSize) + 1;
    const cells: { c: number; r: number }[] = [];
    for (let dr = -range; dr <= range; dr++) {
      for (let dc = -range; dc <= range; dc++) {
        const c = midCell.c + dc;
        const r = midCell.r + dr;
        if (!carver.inBounds(c, r)) continue;
        if (carver.bitmap[r * carver.gridN + c] !== 1) continue;
        const cl = carver.cellCenterLocal(c, r);
        const d: Vec2 = { x: cl.x - mid.x, y: cl.y - mid.y };
        const along = d.x * dir.x + d.y * dir.y;
        const perpDist = d.x * perp.x + d.y * perp.y;
        if (Math.abs(along) <= alongHalf && Math.abs(perpDist) <= perpHalf) cells.push({ c, r });
      }
    }
    return cells;
  }

  private static roomJitter(p: { local: Vec2; hw: number; hh: number }, jitter: (n: number) => number): Vec2 {
    return { x: p.local.x + jitter(p.hw * 0.4), y: p.local.y + jitter(p.hh * 0.4) };
  }

  private static preservesReachability(
    carver: StationCarver,
    entranceCell: { c: number; r: number },
    gateCells: { c: number; r: number }[][],
    switchCells: { c: number; r: number }[],
    centralCell: { c: number; r: number },
    machineryLocal: Vec2[],
    machineryRadius: number,
  ): boolean {
    const states: { open: ReadonlySet<number>; target: { c: number; r: number } }[] = [
      { open: new Set(), target: switchCells[0] },
      { open: new Set([1]), target: switchCells[1] },
      { open: new Set([1, 2]), target: switchCells[2] },
      { open: new Set([1, 2, 3]), target: centralCell },
    ];
    for (const state of states) {
      const reachable = this.reachableCells(carver, entranceCell, state.open, gateCells, machineryLocal, machineryRadius);
      if (!reachable.has(`${state.target.c},${state.target.r}`)) return false;
    }
    return true;
  }

  private static reachableCells(
    carver: StationCarver,
    entranceCell: { c: number; r: number },
    openGates: ReadonlySet<number>,
    gateCells: { c: number; r: number }[][],
    machineryLocal: Vec2[],
    machineryRadius: number,
  ): Set<string> {
    const n = carver.gridN;
    const bitmap = carver.bitmap;
    const blocked = new Set<string>();
    for (let i = 1; i <= 3; i++) {
      if (openGates.has(i)) continue;
      for (const cell of gateCells[i - 1]) blocked.add(`${cell.c},${cell.r}`);
    }
    const blockR = machineryRadius + SHIP_RADIUS + MACHINERY_BLOCK_MARGIN;
    const blockCells = Math.ceil(blockR / carver.cellSize) + 1;
    for (const m of machineryLocal) {
      const center = carver.localToCell(m);
      for (let dr = -blockCells; dr <= blockCells; dr++) {
        for (let dc = -blockCells; dc <= blockCells; dc++) {
          const c = center.c + dc;
          const r = center.r + dr;
          if (!carver.inBounds(c, r)) continue;
          const cc = carver.cellCenterLocal(c, r);
          if (Math.hypot(cc.x - m.x, cc.y - m.y) <= blockR) blocked.add(`${c},${r}`);
        }
      }
    }
    const visited = new Set<string>([`${entranceCell.c},${entranceCell.r}`]);
    const queue: { c: number; r: number }[] = [entranceCell];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = cur.c + dc;
        const nr = cur.r + dr;
        if (nc < 0 || nr < 0 || nc >= n || nr >= n) continue;
        const key = `${nc},${nr}`;
        if (visited.has(key) || blocked.has(key)) continue;
        if (bitmap[nr * n + nc] !== 1) continue;
        visited.add(key);
        queue.push({ c: nc, r: nr });
      }
    }
    return visited;
  }

  private static wallFromSegment(seg: BoundarySegment, center: Vec2, entranceAngle: number, wallHalf: number, carver: StationCarver): StationWall {
    const aWorld = carver.localToWorld(seg.a, center, entranceAngle);
    const bWorld = carver.localToWorld(seg.b, center, entranceAngle);
    const mid: Vec2 = { x: (aWorld.x + bWorld.x) / 2, y: (aWorld.y + bWorld.y) / 2 };
    const dx = bWorld.x - aWorld.x;
    const dy = bWorld.y - aWorld.y;
    const halfLength = Math.max(Math.hypot(dx, dy) / 2, wallHalf * 0.5);
    const angle = Math.atan2(dy, dx);
    return new StationWall(mid, angle, halfLength, wallHalf);
  }
}
