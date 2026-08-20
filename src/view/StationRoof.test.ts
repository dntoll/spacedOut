import { describe, expect, it } from 'vitest';
import { AsteroidBelt } from '../model/AsteroidBelt';
import { DroneField } from '../model/DroneField';
import { LaserField } from '../model/LaserField';
import { PirateField } from '../model/PirateField';
import { Ship } from '../model/Ship';
import { Station } from '../model/Station';
import type { Vec2 } from '../types';
import type { Drawing, Paint } from './Drawing';
import { StationRoof } from './StationRoof';

const STATION_RADIUS = 2000;

const placeStation = (seed = 42): Station => {
  const station = new Station();
  station.placeAt({ x: 0, y: 0 }, STATION_RADIUS, 0, seed);
  return station;
};

const isOpaque = (fill: Paint): boolean => {
  if (typeof fill !== 'string') return false;
  if (fill.startsWith('#') || fill.startsWith('rgb(')) return true;
  const match = /^rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)$/.exec(fill);
  return match !== null && Number.parseFloat(match[1]) >= 1;
};

const pointInPolygon = (p: Vec2, poly: Vec2[]): boolean => {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
};

interface Capture { drawing: Drawing; paths: Vec2[][]; fills: Paint[] }
const capture = (): Capture => {
  const paths: Vec2[][] = [];
  const fills: Paint[] = [];
  const drawing = { fillPolygons: (ps: Vec2[][], fill: Paint) => { paths.push(...ps); fills.push(fill); } } as unknown as Drawing;
  return { drawing, paths, fills };
};

const roofed = (cap: Capture, point: Vec2): boolean => cap.paths.some((quad) => pointInPolygon(point, quad));

const switchPosition = (station: Station, index: number): Vec2 => {
  let pos: Vec2 | null = null;
  station.forEachSwitch((sw) => { if (sw.index === index) pos = sw.position; });
  return pos!;
};

const entranceRoomPosition = (station: Station): Vec2 => {
  const room = station.rooms.find((r) => r.kind === 'entrance');
  return room!.position;
};

const worldCellCenter = (station: Station, key: string): Vec2 => {
  const [c, r] = key.split(',').map(Number);
  return station.carver!.localToWorld(station.carver!.cellCenterLocal(c, r), station.center!, station.entranceAngle);
};

const roomCellKeys = (station: Station, kind: string, index: number): string[] => {
  const carver = station.carver!;
  const center = station.center!;
  const rotation = station.entranceAngle;
  const room = station.rooms.find((r) => r.kind === kind && r.index === index);
  const keys: string[] = [];
  if (!room) return keys;
  const local = carver.worldToLocal(room.position, center, rotation);
  const n = carver.gridN;
  const half = n / 2;
  const cs = carver.cellSize;
  const cMin = Math.max(0, Math.floor((local.x - room.halfWidth) / cs + half));
  const cMax = Math.min(n - 1, Math.ceil((local.x + room.halfWidth) / cs + half));
  const rMin = Math.max(0, Math.floor((local.y - room.halfHeight) / cs + half));
  const rMax = Math.min(n - 1, Math.ceil((local.y + room.halfHeight) / cs + half));
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      if (carver.bitmap[r * n + c] === 1) keys.push(`${c},${r}`);
    }
  }
  return keys;
};

const anyCellRoofed = (cap: Capture, station: Station, keys: string[]): boolean =>
  keys.some((k) => roofed(cap, worldCellCenter(station, k)));

const openGate = (station: Station, index: number): void => {
  const ship = new Ship();
  ship.position = switchPosition(station, index);
  station.update(0, ship, new AsteroidBelt({ x: 0, y: 0 }, []), new DroneField(), new PirateField(), new LaserField());
};

describe('StationRoof', () => {
  it('REQ-86 reveals interior by line of sight (not whole sections), accumulates, and keeps the entrance always visible', () => {
    const station = placeStation();
    const roof = new StationRoof();
    const ship = new Ship();

    const entrance = entranceRoomPosition(station);
    const central = station.centralCenter!;
    const switch1Pos = switchPosition(station, 1);
    const switch2Pos = switchPosition(station, 2);
    const switch1Keys = roomCellKeys(station, 'switch', 1);

    // Ship at the entrance: entrance visible; the switch-1 room sits down a
    // perpendicular corridor around a corner, so line of sight cannot reach it
    // (no straight ray turns the corner) and it stays fully roofed — proving
    // reveal is line-of-sight, not whole-room-on-entry.
    ship.position = { ...entrance };
    let cap = capture();
    roof.draw(cap.drawing, station, ship.position);
    expect(cap.paths.length).toBeGreaterThan(0);
    expect(cap.fills.every(isOpaque)).toBe(true);
    expect(cap.fills.every((f) => f !== '#0a1426')).toBe(true);
    expect(roofed(cap, entrance)).toBe(false);
    expect(roofed(cap, central)).toBe(true);
    expect(roofed(cap, switch2Pos)).toBe(true);
    expect(anyCellRoofed(cap, station, switch1Keys)).toBe(true);

    // Fly the ship into the switch-1 room: line of sight from inside reveals it.
    ship.position = { ...switch1Pos };
    cap = capture();
    roof.draw(cap.drawing, station, ship.position);
    expect(anyCellRoofed(cap, station, switch1Keys)).toBe(false);

    // Return to the entrance: the switch-1 room stays revealed (accumulation),
    // and the central chamber — never seen — stays roofed.
    ship.position = { ...entrance };
    cap = capture();
    roof.draw(cap.drawing, station, ship.position);
    expect(anyCellRoofed(cap, station, switch1Keys)).toBe(false);
    expect(roofed(cap, central)).toBe(true);
  });

  it('REQ-86 opening a gate alone does not reveal the region behind it — line of sight is required', () => {
    const station = placeStation();
    const roof = new StationRoof();
    const ship = new Ship();
    const entrance = entranceRoomPosition(station);
    const switch2Pos = switchPosition(station, 2);

    openGate(station, 1);
    expect(station.isGateOpen(1)).toBe(true);

    ship.position = { ...entrance };
    const cap = capture();
    roof.draw(cap.drawing, station, ship.position);
    expect(roofed(cap, switch2Pos)).toBe(true);
  });

  it('REQ-86 reset() re-roofs previously revealed areas so a restart hides the interior again', () => {
    const station = placeStation();
    const roof = new StationRoof();
    const ship = new Ship();
    const entrance = entranceRoomPosition(station);
    const switch1Pos = switchPosition(station, 1);
    const switch1Keys = roomCellKeys(station, 'switch', 1);

    // Reveal the switch-1 room by flying into it.
    ship.position = { ...switch1Pos };
    let cap = capture();
    roof.draw(cap.drawing, station, ship.position);
    expect(anyCellRoofed(cap, station, switch1Keys)).toBe(false);

    // Reset (restart): the switch-1 room is roofed again even though the station
    // is placed at the identical center, so the roof does not remember the prior run.
    roof.reset();
    ship.position = { ...entrance };
    cap = capture();
    roof.draw(cap.drawing, station, ship.position);
    expect(anyCellRoofed(cap, station, switch1Keys)).toBe(true);
  });
});
