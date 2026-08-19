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
  radius: number;
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

const GRID_N = 100;
const WALL_HALF_FRACTION = 0.035;
const SWITCH_RADIUS = 26;
const PLACE_RETRIES = 40;

interface RoomPlacement {
  id: string;
  kind: RoomKind;
  index: number;
  local: Vec2;
  radius: number;
}

interface CorridorPlan {
  from: string;
  to: string;
  gate: number | null;
}

export class StationMazeGenerator {
  static generate(center: Vec2, outerRadius: number, entranceAngle: number, seed: number): StationLayout {
    const random = new RandomSequence(seed >>> 0);
    const carver = new StationCarver(outerRadius, GRID_N);
    const wallHalf = outerRadius * WALL_HALF_FRACTION;

    const roomRadius = (kind: RoomKind): number => {
      if (kind === 'central') return outerRadius * 0.15;
      if (kind === 'area') return outerRadius * 0.10;
      if (kind === 'entrance') return outerRadius * 0.09;
      return outerRadius * 0.07;
    };
    const corridorHalf = outerRadius * 0.06;

    const placements: RoomPlacement[] = [];
    const byId = new Map<string, RoomPlacement>();
    const place = (id: string, kind: RoomKind, index: number, local: Vec2, radius: number): RoomPlacement => {
      const p: RoomPlacement = { id, kind, index, local: { ...local }, radius };
      placements.push(p);
      byId.set(id, p);
      carver.carveRoom(local, radius, outerRadius * 0.012);
      return p;
    };

    const entranceR = roomRadius('entrance');
    const entranceLocal: Vec2 = { x: outerRadius - entranceR * 0.35, y: 0 };
    place('entrance', 'entrance', 0, entranceLocal, entranceR);

    const corridors: CorridorPlan[] = [
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

    const corridorLen = outerRadius * 0.13;
    const tryPlace = (id: string, kind: RoomKind, index: number, fromId: string): RoomPlacement => {
      const from = byId.get(fromId)!;
      const radius = roomRadius(kind);
      for (let attempt = 0; attempt < PLACE_RETRIES; attempt++) {
        const towardOrigin = Math.atan2(-from.local.y, -from.local.x);
        const baseAngle = towardOrigin + (kind === 'switch' || kind === 'extra'
          ? (random.next() < 0.5 ? 1 : -1) * (Math.PI / 2 + random.between(0, 0.6))
          : random.between(-0.7, 0.7));
        const dist = from.radius + radius + corridorLen;
        const local: Vec2 = {
          x: from.local.x + Math.cos(baseAngle) * dist,
          y: from.local.y + Math.sin(baseAngle) * dist,
        };
        if (carver.fits(local, radius)) {
          carver.carveCorridor(from.local, local, corridorHalf);
          return place(id, kind, index, local, radius);
        }
      }
      const towardOrigin = Math.atan2(-from.local.y, -from.local.x);
      const dist = from.radius + radius + corridorLen;
      const local: Vec2 = { x: from.local.x + Math.cos(towardOrigin) * dist, y: from.local.y + Math.sin(towardOrigin) * dist };
      carver.carveCorridor(from.local, local, corridorHalf);
      return place(id, kind, index, local, radius);
    };

    tryPlace('area1', 'area', 1, 'entrance');
    tryPlace('area2', 'area', 2, 'area1');
    tryPlace('area3', 'area', 3, 'area2');
    tryPlace('central', 'central', 0, 'area3');
    tryPlace('switch1', 'switch', 1, 'area1');
    tryPlace('switch2', 'switch', 2, 'area2');
    tryPlace('switch3', 'switch', 3, 'area3');
    tryPlace('extra1', 'extra', 0, 'switch1');
    tryPlace('extra2', 'extra', 0, 'switch3');

    const gateCells: { c: number; r: number }[][] = [[], [], []];
    const gates: StationGate[] = [];
    const localToWorld = (local: Vec2): Vec2 => carver.localToWorld(local, center, entranceAngle);
    for (const corridor of corridors) {
      if (corridor.gate === null) continue;
      const from = byId.get(corridor.from)!;
      const to = byId.get(corridor.to)!;
      const midLocal: Vec2 = { x: (from.local.x + to.local.x) / 2, y: (from.local.y + to.local.y) / 2 };
      const dx = to.local.x - from.local.x;
      const dy = to.local.y - from.local.y;
      const len = Math.hypot(dx, dy);
      const perp: Vec2 = { x: -dy / len, y: dx / len };
      const gateHalf = corridorHalf + wallHalf;
      const aLocal: Vec2 = { x: midLocal.x + perp.x * gateHalf, y: midLocal.y + perp.y * gateHalf };
      const bLocal: Vec2 = { x: midLocal.x - perp.x * gateHalf, y: midLocal.y - perp.y * gateHalf };
      gateCells[corridor.gate - 1] = carver.carveGateSegment(aLocal, bLocal);
      const aWorld = localToWorld(aLocal);
      const bWorld = localToWorld(bLocal);
      const gateMid: Vec2 = { x: (aWorld.x + bWorld.x) / 2, y: (aWorld.y + bWorld.y) / 2 };
      const gateAngle = Math.atan2(bWorld.y - aWorld.y, bWorld.x - aWorld.x);
      gates.push(new StationGate(corridor.gate, gateMid, gateAngle, gateHalf, wallHalf));
    }

    const jitter = (room: RoomPlacement): Vec2 => ({
      x: room.local.x + random.between(-room.radius * 0.3, room.radius * 0.3),
      y: room.local.y + random.between(-room.radius * 0.3, room.radius * 0.3),
    });
    const switchRooms = ['switch1', 'switch2', 'switch3'].map((id) => byId.get(id)!);
    const switches: StationSwitch[] = switchRooms.map((room, i) =>
      new StationSwitch(i + 1, localToWorld(jitter(room)), SWITCH_RADIUS));
    const switchCells = switchRooms.map((room) => carver.localToCell(jitter(room)));

    const machinery: StationMachinery[] = [];
    const addMachinery = (roomId: string, radius: number): void => {
      const room = byId.get(roomId)!;
      const offset: Vec2 = { x: random.between(-room.radius * 0.4, room.radius * 0.4), y: random.between(-room.radius * 0.4, room.radius * 0.4) };
      const local: Vec2 = { x: room.local.x + offset.x, y: room.local.y + offset.y };
      machinery.push(new StationMachinery(localToWorld(local), radius, random.between(0, Math.PI * 2), random.integer(0, 3)));
    };
    addMachinery('area1', outerRadius * 0.028);
    addMachinery('area2', outerRadius * 0.028);
    addMachinery('area3', outerRadius * 0.028);

    const collectibles: StationCollectibleSpec[] = [
      { position: localToWorld(jitter(byId.get('switch1')!)), type: SupplyType.Fuel },
      { position: localToWorld(jitter(byId.get('switch2')!)), type: SupplyType.Ammo },
      { position: localToWorld(jitter(byId.get('switch3')!)), type: SupplyType.Hp },
      { position: localToWorld(jitter(byId.get('extra1')!)), type: SupplyType.Ammo },
      { position: localToWorld(jitter(byId.get('extra2')!)), type: SupplyType.Fuel },
      { position: localToWorld({ ...byId.get('central')!.local }), type: SupplyType.Hp },
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

    const rooms: StationRoomInstance[] = placements.map((p) => ({
      id: p.id, kind: p.kind, index: p.index, position: localToWorld(p.local), radius: p.radius,
    }));
    const centralPlacement = byId.get('central')!;
    const entrancePlacement = byId.get('entrance')!;
    const entrancePosition = localToWorld({ x: outerRadius, y: 0 });
    const entranceCell = carver.localToCell(entrancePlacement.local);
    const centralCell = carver.localToCell(centralPlacement.local);

    return {
      center,
      outerRadius,
      entrancePosition,
      entranceAngle,
      entranceRadius: entranceR,
      centralCenter: localToWorld(centralPlacement.local),
      centralRadius: centralPlacement.radius,
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
