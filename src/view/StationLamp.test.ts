import { describe, expect, it } from 'vitest';
import { AsteroidBelt } from '../model/AsteroidBelt';
import { DroneField } from '../model/DroneField';
import { LaserField } from '../model/LaserField';
import { PirateField } from '../model/PirateField';
import { Ship } from '../model/Ship';
import { Station } from '../model/Station';
import type { Vec2 } from '../types';
import type { Drawing, Paint } from './Drawing';
import { StationLamp } from './StationLamp';
import { StationRoof } from './StationRoof';

const STATION_RADIUS = 3000;
const R = 320;

const placeStation = (seed = 42): Station => {
  const station = new Station();
  station.placeAt({ x: 0, y: 0 }, STATION_RADIUS, 0, seed);
  return station;
};

const pointInPolygon = (p: Vec2, poly: Vec2[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (((a.y > p.y) !== (b.y > p.y)) && (p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)) {
      inside = !inside;
    }
  }
  return inside;
};

interface Capture {
  drawing: Drawing;
  darkPaths: Vec2[][];
  darkCircle: { center: Vec2; radius: number } | null;
  litPolygon: Vec2[];
  beginShadow: number;
  endShadow: number;
  composite: number;
}
const capture = (): Capture => {
  const cap: Capture = {
    drawing: null as unknown as Drawing,
    darkPaths: [],
    darkCircle: null,
    litPolygon: [],
    beginShadow: 0,
    endShadow: 0,
    composite: 0,
  };
  cap.drawing = {
    beginShadowLayer: () => { cap.beginShadow++; },
    endShadowLayer: () => { cap.endShadow++; },
    compositeShadowLayer: () => { cap.composite++; },
    withCamera: (_position: unknown, _zoom: number, draw: () => void) => draw(),
    fillPolygons: (paths: Vec2[][], _fill: Paint) => { cap.darkPaths.push(...paths); },
    polygon: (points: Vec2[], _fill: Paint) => { cap.litPolygon = points; },
    circle: (center: Vec2, radius: number, _fill: Paint) => { cap.darkCircle = { center: { ...center }, radius }; },
  } as unknown as Drawing;
  return cap;
};

const carveableCellCenters = (station: Station): Vec2[] => {
  const carver = station.carver!;
  const center = station.center!;
  const rotation = station.entranceAngle;
  const out: Vec2[] = [];
  for (let r = 0; r < carver.gridN; r++) {
    for (let c = 0; c < carver.gridN; c++) {
      if (carver.bitmap[r * carver.gridN + c] !== 1) continue;
      out.push(carver.localToWorld(carver.cellCenterLocal(c, r), center, rotation));
    }
  }
  return out;
};

const darkCovers = (cap: Capture, point: Vec2): boolean => {
  if (cap.darkPaths.some((quad) => pointInPolygon(point, quad))) return true;
  if (cap.darkCircle) {
    const dx = point.x - cap.darkCircle.center.x;
    const dy = point.y - cap.darkCircle.center.y;
    if (dx * dx + dy * dy <= cap.darkCircle.radius * cap.darkCircle.radius) return true;
  }
  return false;
};

const roomCenter = (station: Station, kind: string, index: number): Vec2 => {
  const room = station.rooms.find((r) => r.kind === kind && r.index === index);
  return room!.position;
};

const gatePosition = (station: Station, index: number): Vec2 => {
  let pos: Vec2 | null = null;
  station.forEachGate((g) => { if (g.index === index) pos = g.position; });
  return pos!;
};

const openGate = (station: Station, index: number): void => {
  const ship = new Ship();
  let switchPos: Vec2 | null = null;
  station.forEachSwitch((sw) => { if (sw.index === index) switchPos = sw.position; });
  ship.position = switchPos!;
  station.update(0, ship, new AsteroidBelt({ x: 0, y: 0 }, []), new DroneField(), new PirateField(), new LaserField());
};

describe('StationLamp', () => {
  it('REQ-87 darkens the entire carved interior (dim or black) and leaves space outside the station unaffected', () => {
    const station = placeStation();
    const lamp = new StationLamp();
    const roof = new StationRoof();
    const ship = new Ship();
    ship.position = roomCenter(station, 'entrance', 0);
    const cap = capture();

    lamp.draw(cap.drawing, station, ship.position, { x: 0, y: 0 }, 1, R, roof);

    expect(cap.beginShadow).toBe(1);
    expect(cap.endShadow).toBe(1);
    expect(cap.composite).toBe(1);
    // Every carved interior cell is darkened (dim if revealed, black if not).
    for (const cell of carveableCellCenters(station)) {
      expect(darkCovers(cap, cell)).toBe(true);
    }
    // Space well outside the station is unaffected.
    const outside: Vec2 = { x: station.outerRadius * 2.5, y: station.outerRadius * 2.5 };
    expect(darkCovers(cap, outside)).toBe(false);
  });

  it('REQ-87 lights the ship vicinity within radius and line of sight; a point beyond the radius is not lit', () => {
    const station = placeStation();
    const lamp = new StationLamp();
    const roof = new StationRoof();
    const ship = new Ship();
    const entrance = roomCenter(station, 'entrance', 0);
    ship.position = entrance;
    const cap = capture();

    lamp.draw(cap.drawing, station, ship.position, { x: 0, y: 0 }, 1, R, roof);

    expect(cap.litPolygon.length).toBeGreaterThanOrEqual(3);
    expect(pointInPolygon(entrance, cap.litPolygon)).toBe(true);
    const beyond: Vec2 = { x: entrance.x + R + 120, y: entrance.y };
    expect(pointInPolygon(beyond, cap.litPolygon)).toBe(false);
  });

  it('REQ-87 is blocked by line of sight — carved cells within radius but around a wall stay dark while the ship cell is lit', () => {
    const station = placeStation();
    const lamp = new StationLamp();
    const roof = new StationRoof();
    const ship = new Ship();
    ship.position = roomCenter(station, 'area', 1);
    const cap = capture();
    const lampR = STATION_RADIUS * 0.6;

    lamp.draw(cap.drawing, station, ship.position, { x: 0, y: 0 }, 1, lampR, roof);

    expect(pointInPolygon(ship.position, cap.litPolygon)).toBe(true);
    const carver = station.carver!;
    const center = station.center!;
    const rotation = station.entranceAngle;
    let litWithin = 0;
    let darkWithin = 0;
    for (let r = 0; r < carver.gridN; r++) {
      for (let c = 0; c < carver.gridN; c++) {
        if (carver.bitmap[r * carver.gridN + c] !== 1) continue;
        const world = carver.localToWorld(carver.cellCenterLocal(c, r), center, rotation);
        const dx = world.x - ship.position.x;
        const dy = world.y - ship.position.y;
        if (dx * dx + dy * dy > lampR * lampR) continue;
        if (pointInPolygon(world, cap.litPolygon)) litWithin++;
        else darkWithin++;
      }
    }
    expect(litWithin).toBeGreaterThan(0);
    expect(darkWithin).toBeGreaterThan(0);
  });

  it('REQ-87 closed gate blocks the lamp; opening the gate lets the lamp through within radius and line of sight', () => {
    const station = placeStation();
    const lamp = new StationLamp();
    const entrance = roomCenter(station, 'entrance', 0);
    const area1 = roomCenter(station, 'area', 1);
    const gate = gatePosition(station, 1);
    const dir = { x: area1.x - entrance.x, y: area1.y - entrance.y };
    const dl = Math.hypot(dir.x, dir.y);
    const ux = dir.x / dl;
    const uy = dir.y / dl;
    const shipPos: Vec2 = { x: gate.x - ux * 120, y: gate.y - uy * 120 };
    const probe: Vec2 = { x: gate.x + ux * 120, y: gate.y + uy * 120 };
    expect(Math.hypot(probe.x - shipPos.x, probe.y - shipPos.y)).toBeLessThan(R);

    expect(station.isGateOpen(1)).toBe(false);
    let cap = capture();
    lamp.draw(cap.drawing, station, shipPos, { x: 0, y: 0 }, 1, R, new StationRoof());
    expect(pointInPolygon(shipPos, cap.litPolygon)).toBe(true);
    expect(pointInPolygon(probe, cap.litPolygon)).toBe(false);

    openGate(station, 1);
    expect(station.isGateOpen(1)).toBe(true);
    cap = capture();
    lamp.draw(cap.drawing, station, shipPos, { x: 0, y: 0 }, 1, R, new StationRoof());
    expect(pointInPolygon(probe, cap.litPolygon)).toBe(true);
  });

  it('REQ-87 with zero lamp radius renders darkness (concealment) but no lamp light', () => {
    const station = placeStation();
    const lamp = new StationLamp();
    const roof = new StationRoof();
    const ship = new Ship();
    ship.position = roomCenter(station, 'entrance', 0);
    const cap = capture();

    lamp.draw(cap.drawing, station, ship.position, { x: 0, y: 0 }, 1, 0, roof);

    // Darkness still renders (conceals interior).
    expect(cap.beginShadow).toBe(1);
    expect(cap.composite).toBe(1);
    expect(cap.darkCircle).not.toBeNull();
    // No lamp light polygon.
    expect(cap.litPolygon.length).toBe(0);
  });
});
