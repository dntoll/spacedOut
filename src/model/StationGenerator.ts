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

interface RoomSpec {
  id: string;
  kind: RoomKind;
  index: number;
  x: number;
  y: number;
  hw: number;
  hh: number;
}

interface CorridorPlan {
  from: string;
  to: string;
  gate: number | null;
}

// Axis-aligned horizontal-spine layout (local space, fractions of outerRadius,
// +x toward the entrance). Rooms are rectangles; corridors are straight H/V
// rectangles forming a tree so gates cleanly block BFS reachability (REQ-80).
const ROOM_SPECS: RoomSpec[] = [
  { id: 'central', kind: 'central', index: 0, x: 0.00, y: 0.00, hw: 0.12, hh: 0.14 },
  { id: 'area3', kind: 'area', index: 3, x: 0.30, y: 0.00, hw: 0.09, hh: 0.11 },
  { id: 'area2', kind: 'area', index: 2, x: 0.54, y: 0.00, hw: 0.09, hh: 0.11 },
  { id: 'area1', kind: 'area', index: 1, x: 0.78, y: 0.00, hw: 0.09, hh: 0.11 },
  { id: 'entrance', kind: 'entrance', index: 0, x: 0.96, y: 0.00, hw: 0.07, hh: 0.09 },
  { id: 'switch1', kind: 'switch', index: 1, x: 0.78, y: -0.30, hw: 0.07, hh: 0.07 },
  { id: 'switch2', kind: 'switch', index: 2, x: 0.54, y: 0.30, hw: 0.07, hh: 0.07 },
  { id: 'switch3', kind: 'switch', index: 3, x: 0.30, y: -0.30, hw: 0.07, hh: 0.07 },
  { id: 'extra1', kind: 'extra', index: 0, x: 0.78, y: -0.52, hw: 0.06, hh: 0.06 },
  { id: 'extra2', kind: 'extra', index: 0, x: 0.30, y: -0.52, hw: 0.06, hh: 0.06 },
];

const CORRIDORS: CorridorPlan[] = [
  { from: 'entrance', to: 'area1', gate: null },
  { from: 'area1', to: 'area2', gate: 1 },
  { from: 'area2', to: 'area3', gate: 2 },
  { from: 'area3', to: 'central', gate: 3 },
  { from: 'area1', to: 'switch1', gate: null },
  { from: 'area2', to: 'switch2', gate: null },
  { from: 'area3', to: 'switch3', gate: null },
  { from: 'switch1', to: 'extra1', gate: null },
  { from: 'switch3', to: 'extra2', gate: null },
];

export class StationGenerator {
  static generate(center: Vec2, outerRadius: number, entranceAngle: number, seed: number): StationLayout {
    const random = new RandomSequence(seed >>> 0);
    const carver = new StationCarver(outerRadius, CELL_SIZE);
    const wallHalf = outerRadius * WALL_HALF_FRACTION;
    const corridorHalf = outerRadius * CORRIDOR_HALF_FRACTION;
    const localToWorld = (local: Vec2): Vec2 => carver.localToWorld(local, center, entranceAngle);

    const byId = new Map<string, RoomSpec>();
    for (const spec of ROOM_SPECS) byId.set(spec.id, spec);

    const scaleRoom = (spec: RoomSpec): Vec2 => ({ x: spec.x * outerRadius, y: spec.y * outerRadius });
    const jitter = (amount: number): number => random.between(-amount, amount);

    for (const spec of ROOM_SPECS) {
      const local = scaleRoom(spec);
      const hw = spec.hw * outerRadius + jitter(outerRadius * 0.005);
      const hh = spec.hh * outerRadius + jitter(outerRadius * 0.005);
      carver.carveRectRoom(local, hw, hh, outerRadius * 0.004);
    }

    for (const corridor of CORRIDORS) {
      const from = byId.get(corridor.from)!;
      const to = byId.get(corridor.to)!;
      const a = scaleRoom(from);
      const b = scaleRoom(to);
      carver.carveRectCorridor(a, b, corridorHalf);
    }

    const gateCells: { c: number; r: number }[][] = [[], [], []];
    const gates: StationGate[] = [];
    for (const corridor of CORRIDORS) {
      if (corridor.gate === null) continue;
      const from = byId.get(corridor.from)!;
      const to = byId.get(corridor.to)!;
      const aLocal = scaleRoom(from);
      const bLocal = scaleRoom(to);
      const midLocal: Vec2 = { x: (aLocal.x + bLocal.x) / 2, y: (aLocal.y + bLocal.y) / 2 };
      const dx = bLocal.x - aLocal.x;
      const dy = bLocal.y - aLocal.y;
      const len = Math.hypot(dx, dy);
      const perp: Vec2 = { x: -dy / len, y: dx / len };
      const gateHalf = corridorHalf + wallHalf;
      const ga: Vec2 = { x: midLocal.x + perp.x * gateHalf, y: midLocal.y + perp.y * gateHalf };
      const gb: Vec2 = { x: midLocal.x - perp.x * gateHalf, y: midLocal.y - perp.y * gateHalf };
      gateCells[corridor.gate - 1] = carver.carveGateSegment(ga, gb);
      const gaWorld = localToWorld(ga);
      const gbWorld = localToWorld(gb);
      const gateMid: Vec2 = { x: (gaWorld.x + gbWorld.x) / 2, y: (gaWorld.y + gbWorld.y) / 2 };
      const gateAngle = Math.atan2(gbWorld.y - gaWorld.y, gbWorld.x - gaWorld.x);
      gates.push(new StationGate(corridor.gate, gateMid, gateAngle, gateHalf, wallHalf));
    }

    const switchSpecs = ['switch1', 'switch2', 'switch3'].map((id) => byId.get(id)!);
    const switchLocalPositions: Vec2[] = switchSpecs.map((spec) => {
      const base = scaleRoom(spec);
      const roomHalf = spec.hw * outerRadius;
      return { x: base.x + jitter(roomHalf * 0.4), y: base.y + jitter(roomHalf * 0.4) };
    });
    const switches: StationSwitch[] = switchLocalPositions.map((local, i) =>
      new StationSwitch(i + 1, localToWorld(local), SWITCH_RADIUS));
    const switchCells = switchLocalPositions.map((local) => carver.localToCell(local));

    const machinery: StationMachinery[] = [];
    const addMachinery = (roomId: string, radius: number): void => {
      const spec = byId.get(roomId)!;
      const base = scaleRoom(spec);
      const roomHalf = spec.hw * outerRadius;
      const local: Vec2 = { x: base.x + jitter(roomHalf * 0.5), y: base.y + jitter(spec.hh * outerRadius * 0.5) };
      machinery.push(new StationMachinery(localToWorld(local), radius, random.between(0, Math.PI * 2), random.integer(0, 3)));
    };
    addMachinery('area1', outerRadius * 0.028);
    addMachinery('area2', outerRadius * 0.028);
    addMachinery('area3', outerRadius * 0.028);

    const collectibleLocal = (roomId: string): Vec2 => {
      const spec = byId.get(roomId)!;
      const base = scaleRoom(spec);
      const roomHalf = spec.hw * outerRadius;
      return { x: base.x + jitter(roomHalf * 0.4), y: base.y + jitter(spec.hh * outerRadius * 0.4) };
    };
    const collectibles: StationCollectibleSpec[] = [
      { position: localToWorld(collectibleLocal('switch1')), type: SupplyType.Fuel },
      { position: localToWorld(collectibleLocal('switch2')), type: SupplyType.Ammo },
      { position: localToWorld(collectibleLocal('switch3')), type: SupplyType.Hp },
      { position: localToWorld(collectibleLocal('extra1')), type: SupplyType.Ammo },
      { position: localToWorld(collectibleLocal('extra2')), type: SupplyType.Fuel },
      { position: localToWorld({ ...scaleRoom(byId.get('central')!) }), type: SupplyType.Hp },
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

    const rooms: StationRoomInstance[] = ROOM_SPECS.map((spec) => ({
      id: spec.id,
      kind: spec.kind,
      index: spec.index,
      position: localToWorld(scaleRoom(spec)),
      halfWidth: spec.hw * outerRadius,
      halfHeight: spec.hh * outerRadius,
    }));
    const entranceSpec = byId.get('entrance')!;
    const centralSpec = byId.get('central')!;
    const entrancePosition = localToWorld({ x: outerRadius, y: 0 });
    const entranceRadius = entranceSpec.hh * outerRadius;

    return {
      center,
      outerRadius,
      entrancePosition,
      entranceAngle,
      entranceRadius,
      centralCenter: localToWorld(scaleRoom(centralSpec)),
      centralRadius: centralSpec.hw * outerRadius,
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
      entranceCell: carver.localToCell(scaleRoom(entranceSpec)),
      centralCell: carver.localToCell(scaleRoom(centralSpec)),
    };
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
