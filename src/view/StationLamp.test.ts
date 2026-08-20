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

const STATION_RADIUS = 2000;
const R = 450;

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
  dimPaths: Vec2[][];
  litPolygon: Vec2[];
  beginShadow: number;
  endShadow: number;
  composite: number;
}
const capture = (): Capture => {
  const cap: Capture = {
    drawing: null as unknown as Drawing,
    dimPaths: [],
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
    fillPolygons: (paths: Vec2[][], _fill: Paint) => { cap.dimPaths.push(...paths); },
    polygon: (points: Vec2[], _fill: Paint) => { cap.litPolygon = points; },
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

const dimCovers = (cap: Capture, point: Vec2): boolean =>
  cap.dimPaths.some((quad) => pointInPolygon(point, quad));

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
  it('REQ-87 dims the entire carved interior as the memory base and leaves space outside the station unaffected', () => {
    const station = placeStation();
    const lamp = new StationLamp();
    const ship = new Ship();
    ship.position = roomCenter(station, 'entrance', 0);
    const cap = capture();

    lamp.draw(cap.drawing, station, ship.position, { x: 0, y: 0 }, 1, R);

    expect(cap.beginShadow).toBe(1);
    expect(cap.endShadow).toBe(1);
    expect(cap.composite).toBe(1);
    // The dim layer covers every carved interior cell.
    for (const cell of carveableCellCenters(station)) {
      expect(dimCovers(cap, cell)).toBe(true);
    }
    // Space well outside the station is not dimmed.
    const outside: Vec2 = { x: station.outerRadius * 2.5, y: station.outerRadius * 2.5 };
    expect(dimCovers(cap, outside)).toBe(false);
  });

  it('REQ-87 lights the ship vicinity within radius and line of sight; a point beyond the radius is not lit', () => {
    const station = placeStation();
    const lamp = new StationLamp();
    const ship = new Ship();
    const entrance = roomCenter(station, 'entrance', 0);
    ship.position = entrance;
    const cap = capture();

    lamp.draw(cap.drawing, station, ship.position, { x: 0, y: 0 }, 1, R);

    expect(cap.litPolygon.length).toBeGreaterThanOrEqual(3);
    // The ship itself is lit.
    expect(pointInPolygon(entrance, cap.litPolygon)).toBe(true);
    // A point beyond the lamp radius (in the open entrance direction) is not lit.
    const beyond: Vec2 = { x: entrance.x + R + 120, y: entrance.y };
    expect(pointInPolygon(beyond, cap.litPolygon)).toBe(false);
  });

  it('REQ-87 is blocked by line of sight — carved cells within radius but around a wall stay dark while the ship cell is lit', () => {
    const station = placeStation();
    const lamp = new StationLamp();
    const ship = new Ship();
    ship.position = roomCenter(station, 'area', 1);
    const cap = capture();

    lamp.draw(cap.drawing, station, ship.position, { x: 0, y: 0 }, 1, R);

    expect(pointInPolygon(ship.position, cap.litPolygon)).toBe(true);
    // Among carved cells within radius, walls block line of sight to at least some.
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
        if (dx * dx + dy * dy > R * R) continue;
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
    // Gate 1 sits on the corridor between the entrance and section B (area 1).
    const dir = { x: area1.x - entrance.x, y: area1.y - entrance.y };
    const dl = Math.hypot(dir.x, dir.y);
    const ux = dir.x / dl;
    const uy = dir.y / dl;
    // Ship just before the gate (entrance side), probe just past the gate (area-1 side), within radius.
    const shipPos: Vec2 = { x: gate.x - ux * 160, y: gate.y - uy * 160 };
    const probe: Vec2 = { x: gate.x + ux * 160, y: gate.y + uy * 160 };
    expect(Math.hypot(probe.x - shipPos.x, probe.y - shipPos.y)).toBeLessThan(R);

    // Gate closed: the probe behind the closed gate is not lit.
    expect(station.isGateOpen(1)).toBe(false);
    let cap = capture();
    lamp.draw(cap.drawing, station, shipPos, { x: 0, y: 0 }, 1, R);
    expect(pointInPolygon(shipPos, cap.litPolygon)).toBe(true);
    expect(pointInPolygon(probe, cap.litPolygon)).toBe(false);

    // Open gate 1: the lamp now reaches the probe through the open passage.
    openGate(station, 1);
    expect(station.isGateOpen(1)).toBe(true);
    cap = capture();
    lamp.draw(cap.drawing, station, shipPos, { x: 0, y: 0 }, 1, R);
    expect(pointInPolygon(probe, cap.litPolygon)).toBe(true);
  });

  it('REQ-87 is inactive when the lamp radius is zero, producing no lighting pass', () => {
    const station = placeStation();
    const lamp = new StationLamp();
    const ship = new Ship();
    ship.position = roomCenter(station, 'entrance', 0);
    const cap = capture();

    lamp.draw(cap.drawing, station, ship.position, { x: 0, y: 0 }, 1, 0);

    expect(cap.beginShadow).toBe(0);
    expect(cap.composite).toBe(0);
    expect(cap.dimPaths.length).toBe(0);
    expect(cap.litPolygon.length).toBe(0);
  });
});
