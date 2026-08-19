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
const MACHINERY_RADIUS_FRACTION = 0.028;
const MACHINERY_BLOCK_MARGIN = 6;
const PLACE_RETRIES = 80;
const BRANCHES_PER_ZONE = 12;
const CENTRAL_ANNEXES = 4;
const BRANCH_KEEP_OUT_FRACTION = 0.88;

interface RoomPlacement {
  id: string;
  kind: RoomKind;
  index: number;
  local: Vec2;
  hw: number;
  hh: number;
}

interface CorridorPlan {
  from: string;
  to: string;
  gate: number | null;
}

interface SpineSpec {
  id: string;
  kind: RoomKind;
  index: number;
  x: number;
  y: number;
  hw: number;
  hh: number;
}

interface SwitchSpec {
  id: string;
  x: number;
  y: number;
  hw: number;
  hh: number;
}

interface ZoneSpec {
  minX: number;
  maxX: number;
  hub: string;
  switchId: string;
}

const SPINE: SpineSpec[] = [
  { id: 'central', kind: 'central', index: 0, x: 0.00, y: 0.00, hw: 0.13, hh: 0.15 },
  { id: 'hub2', kind: 'area', index: 3, x: 0.26, y: 0.00, hw: 0.09, hh: 0.11 },
  { id: 'hub1', kind: 'area', index: 2, x: 0.50, y: 0.00, hw: 0.09, hh: 0.11 },
  { id: 'hub0', kind: 'area', index: 1, x: 0.74, y: 0.00, hw: 0.09, hh: 0.11 },
  { id: 'entrance', kind: 'entrance', index: 0, x: 0.95, y: 0.00, hw: 0.06, hh: 0.08 },
];

const SWITCH_SPECS: SwitchSpec[] = [
  { id: 'switch1', x: 0.74, y: -0.24, hw: 0.07, hh: 0.07 },
  { id: 'switch2', x: 0.50, y: 0.24, hw: 0.07, hh: 0.07 },
  { id: 'switch3', x: 0.26, y: -0.24, hw: 0.07, hh: 0.07 },
];

const SPINE_CORRIDORS: CorridorPlan[] = [
  { from: 'entrance', to: 'hub0', gate: null },
  { from: 'hub0', to: 'hub1', gate: 1 },
  { from: 'hub1', to: 'hub2', gate: 2 },
  { from: 'hub2', to: 'central', gate: 3 },
];

const ZONES: ZoneSpec[] = [
  { minX: 0.62, maxX: 1.00, hub: 'hub0', switchId: 'switch1' },
  { minX: 0.38, maxX: 0.62, hub: 'hub1', switchId: 'switch2' },
  { minX: 0.14, maxX: 0.38, hub: 'hub2', switchId: 'switch3' },
];

export class StationGenerator {
  static generate(center: Vec2, outerRadius: number, entranceAngle: number, seed: number): StationLayout {
    const random = new RandomSequence(seed >>> 0);
    const carver = new StationCarver(outerRadius, CELL_SIZE);
    const wallHalf = outerRadius * WALL_HALF_FRACTION;
    const corridorHalf = outerRadius * CORRIDOR_HALF_FRACTION;
    const localToWorld = (local: Vec2): Vec2 => carver.localToWorld(local, center, entranceAngle);
    const jitter = (amount: number): number => random.between(-amount, amount);

    const placements = new Map<string, RoomPlacement>();
    const place = (id: string, kind: RoomKind, index: number, local: Vec2, hw: number, hh: number): RoomPlacement => {
      const p: RoomPlacement = { id, kind, index, local: { ...local }, hw, hh };
      placements.set(id, p);
      return p;
    };

    for (const spec of SPINE) {
      const local = { x: spec.x * outerRadius, y: spec.y * outerRadius };
      const hw = spec.hw * outerRadius;
      const hh = spec.hh * outerRadius;
      carver.carveRectRoom(local, hw, hh, outerRadius * 0.004);
      place(spec.id, spec.kind, spec.index, local, hw, hh);
    }
    for (const spec of SWITCH_SPECS) {
      const local = { x: spec.x * outerRadius + jitter(outerRadius * 0.01), y: spec.y * outerRadius + jitter(outerRadius * 0.01) };
      const hw = spec.hw * outerRadius;
      const hh = spec.hh * outerRadius;
      carver.carveRectRoom(local, hw, hh, outerRadius * 0.004);
      place(spec.id, 'switch', SWITCH_SPECS.indexOf(spec) + 1, local, hw, hh);
    }

    for (const corridor of SPINE_CORRIDORS) {
      const from = placements.get(corridor.from)!;
      const to = placements.get(corridor.to)!;
      carver.carveRectCorridor(from.local, to.local, corridorHalf);
    }

    for (const zone of ZONES) {
      const hub = placements.get(zone.hub)!;
      const sw = placements.get(zone.switchId)!;
      carver.carveRectCorridor(hub.local, sw.local, corridorHalf);
    }

    const branchHwBase = outerRadius * 0.06;
    const corridorLen = outerRadius * 0.07;
    const keepOut = outerRadius * BRANCH_KEEP_OUT_FRACTION;
    const tryPlaceBranch = (parentIds: string[], id: string, minX: number, maxX: number): string | null => {
      for (let attempt = 0; attempt < PLACE_RETRIES; attempt++) {
        const parentId = parentIds[random.integer(0, parentIds.length)];
        const parent = placements.get(parentId)!;
        const hw = branchHwBase * random.between(0.85, 1.35);
        const hh = branchHwBase * random.between(0.85, 1.35);
        const up = random.next() < 0.5;
        const angle = (up ? -1 : 1) * random.between(Math.PI * 0.20, Math.PI * 0.80);
        const dist = Math.max(parent.hw, parent.hh) + Math.max(hw, hh) + corridorLen;
        const local: Vec2 = {
          x: parent.local.x + Math.cos(angle) * dist,
          y: parent.local.y + Math.sin(angle) * dist,
        };
        if (local.x - hw < minX || local.x + hw > maxX) continue;
        const farExtent = Math.hypot(local.x, local.y) + Math.max(hw, hh);
        if (farExtent > keepOut) continue;
        if (!carver.fitsRect(local, hw, hh)) continue;
        carver.carveRectRoom(local, hw, hh, outerRadius * 0.003);
        carver.carveRectCorridor(parent.local, local, corridorHalf);
        place(id, 'extra', 0, local, hw, hh);
        return id;
      }
      return null;
    };

    for (let z = 0; z < ZONES.length; z++) {
      const zone = ZONES[z];
      const minX = zone.minX * outerRadius;
      const maxX = zone.maxX * outerRadius;
      const parentIds = [zone.hub, zone.switchId];
      for (let b = 0; b < BRANCHES_PER_ZONE; b++) {
        const id = `z${z}b${b}`;
        const placed = tryPlaceBranch(parentIds, id, minX, maxX);
        if (placed) parentIds.push(placed);
      }
    }

    const centralMinX = -0.14 * outerRadius;
    const centralMaxX = 0.14 * outerRadius;
    const centralParents = ['central'];
    for (let b = 0; b < CENTRAL_ANNEXES; b++) {
      const id = `cab${b}`;
      const placed = tryPlaceBranch(centralParents, id, centralMinX, centralMaxX);
      if (placed) centralParents.push(placed);
    }

    const gateCells: { c: number; r: number }[][] = [[], [], []];
    const gates: StationGate[] = [];
    for (const corridor of SPINE_CORRIDORS) {
      if (corridor.gate === null) continue;
      const from = placements.get(corridor.from)!;
      const to = placements.get(corridor.to)!;
      const midLocal: Vec2 = { x: (from.local.x + to.local.x) / 2, y: (from.local.y + to.local.y) / 2 };
      const dx = to.local.x - from.local.x;
      const dy = to.local.y - from.local.y;
      const len = Math.hypot(dx, dy);
      const perp: Vec2 = { x: -dy / len, y: dx / len };
      const gateHalf = corridorHalf + wallHalf;
      const ga: Vec2 = { x: midLocal.x + perp.x * gateHalf, y: midLocal.y + perp.y * gateHalf };
      const gb: Vec2 = { x: midLocal.x - perp.x * gateHalf, y: midLocal.y - perp.y * gateHalf };
      const vertical = Math.abs(dx) >= Math.abs(dy);
      gateCells[corridor.gate - 1] = carver.gateSlice(vertical ? midLocal.x : midLocal.y, vertical);
      const gaWorld = localToWorld(ga);
      const gbWorld = localToWorld(gb);
      const gateMid: Vec2 = { x: (gaWorld.x + gbWorld.x) / 2, y: (gaWorld.y + gbWorld.y) / 2 };
      const gateAngle = Math.atan2(gbWorld.y - gaWorld.y, gbWorld.x - gaWorld.x);
      gates.push(new StationGate(corridor.gate, gateMid, gateAngle, gateHalf, wallHalf));
    }

    const switchPlacements = ['switch1', 'switch2', 'switch3'].map((id) => placements.get(id)!);
    const switchLocalPositions: Vec2[] = switchPlacements.map((p) => ({
      x: p.local.x + jitter(p.hw * 0.4),
      y: p.local.y + jitter(p.hh * 0.4),
    }));
    const switches: StationSwitch[] = switchLocalPositions.map((local, i) =>
      new StationSwitch(i + 1, localToWorld(local), SWITCH_RADIUS));
    const switchCells = switchLocalPositions.map((local) => carver.localToCell(local));

    const entrancePlacement = placements.get('entrance')!;
    const centralPlacement = placements.get('central')!;
    const entranceCell = carver.localToCell(entrancePlacement.local);
    const centralCell = carver.localToCell(centralPlacement.local);

    const machineryRadius = outerRadius * MACHINERY_RADIUS_FRACTION;
    const machineryCandidates: Vec2[] = [];
    const machineryHosts = ['hub0', 'hub1', 'hub2', 'central'];
    for (const id of machineryHosts) {
      const p = placements.get(id)!;
      machineryCandidates.push({ x: p.local.x + jitter(p.hw * 0.25), y: p.local.y + jitter(p.hh * 0.25) });
    }
    for (const p of placements.values()) {
      if (p.kind !== 'extra') continue;
      if (Math.min(p.hw, p.hh) < machineryRadius + SHIP_RADIUS * 2 + MACHINERY_BLOCK_MARGIN) continue;
      machineryCandidates.push({ x: p.local.x + jitter(p.hw * 0.2), y: p.local.y + jitter(p.hh * 0.2) });
    }

    const acceptedMachinery: Vec2[] = [];
    for (const candidate of machineryCandidates) {
      const trial = [...acceptedMachinery, candidate];
      if (this.preservesReachability(carver, entranceCell, gateCells, switchCells, centralCell, trial, machineryRadius)) {
        acceptedMachinery.push(candidate);
      }
    }
    const machinery: StationMachinery[] = acceptedMachinery.map((local) =>
      new StationMachinery(localToWorld(local), machineryRadius, random.between(0, Math.PI * 2), random.integer(0, 3)));

    const collectibleRooms = ['switch1', 'switch2', 'switch3', 'cab0', 'cab1', 'central'];
    const collectibles: StationCollectibleSpec[] = [
      { position: localToWorld(this.roomJitter(placements.get('switch1')!, jitter)), type: SupplyType.Fuel },
      { position: localToWorld(this.roomJitter(placements.get('switch2')!, jitter)), type: SupplyType.Ammo },
      { position: localToWorld(this.roomJitter(placements.get('switch3')!, jitter)), type: SupplyType.Hp },
      { position: localToWorld(this.roomJitter(placements.get('cab0') ?? centralPlacement, jitter)), type: SupplyType.Ammo },
      { position: localToWorld(this.roomJitter(placements.get('cab1') ?? centralPlacement, jitter)), type: SupplyType.Fuel },
      { position: localToWorld({ ...centralPlacement.local }), type: SupplyType.Hp },
    ];

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
      entranceRadius: entrancePlacement.hh,
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
