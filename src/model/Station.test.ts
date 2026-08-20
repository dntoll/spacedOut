import { describe, expect, it } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { DroneField } from './DroneField';
import { LaserField } from './LaserField';
import { boundaryRadiusAt } from './MassiveAsteroid';
import { PirateField } from './PirateField';
import { Ship } from './Ship';
import { Station } from './Station';
import { pointOnCircle } from './StationGeometry';
import { isCapsuleObstacle } from './SweptCircleCollision';
import { length, sub } from '../math';
import type { Vec2 } from '../types';

const STATION_RADIUS = 2000;
const placeStation = (entranceAngle = 0, seed = 42): Station => {
  const station = new Station();
  station.placeAt({ x: 0, y: 0 }, STATION_RADIUS, entranceAngle, seed);
  return station;
};

const reachable = (station: Station, target: { c: number; r: number }, openGates: ReadonlySet<number>): boolean => {
  const carver = station.carver!;
  const n = carver.gridN;
  const bitmap = carver.bitmap;
  const start = station.entranceCell!;
  const blocked = new Set<string>();
  for (let i = 1; i <= 3; i++) if (!openGates.has(i)) for (const cell of station.gateCells(i)) blocked.add(`${cell.c},${cell.r}`);
  const visited = new Set<string>([`${start.c},${start.r}`]);
  const queue: { c: number; r: number }[] = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.c === target.c && cur.r === target.r) return true;
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
  return false;
};

describe('Station', () => {
  it('REQ-79 builds a maze-scale station with an entrance, central chamber, walls, machinery, and collectibles', () => {
    const ship = new Ship();
    const station = placeStation();
    expect(station.isPlaced).toBe(true);
    expect(station.outerRadius).toBeGreaterThanOrEqual(ship.radius * 30);
    expect(station.entrancePosition).not.toBeNull();
    expect(station.centralCenter).not.toBeNull();
    expect(station.centralRadius).toBeGreaterThan(0);

    let wallCount = 0;
    let machineryCount = 0;
    let collectibleCount = 0;
    station.forEachWall(() => wallCount++);
    station.forEachMachinery(() => machineryCount++);
    station.forEachCollectible(() => collectibleCount++);
    expect(wallCount).toBeGreaterThan(20);
    expect(machineryCount).toBeGreaterThan(0);
    expect(collectibleCount).toBeGreaterThan(0);
  });

  it('REQ-79 walls are immovable squared polygon obstacles and machinery are immovable massive-asteroid-tier obstacles', () => {
    const station = placeStation();
    let wallSeen = false;
    station.forEachWall((wall) => {
      wallSeen = true;
      expect(wall.mass).toBe(Number.POSITIVE_INFINITY);
      expect(wall.velocity).toEqual({ x: 0, y: 0 });
      expect(wall.massive).toBe(true);
      expect(isCapsuleObstacle(wall)).toBe(false);
      expect(wall.vertices.length).toBeGreaterThan(0);
      expect(wall.halfLength).toBeGreaterThan(0);
      expect(wall.halfWidth).toBeGreaterThan(0);
    });
    expect(wallSeen).toBe(true);
    station.forEachMachinery((m) => {
      expect(m.mass).toBe(Number.POSITIVE_INFINITY);
      expect(m.velocity).toEqual({ x: 0, y: 0 });
      expect(m.massive).toBe(true);
      expect(isCapsuleObstacle(m)).toBe(false);
    });
  });

  it('REQ-79 has a single exterior entrance gap the ship can fly through', () => {
    const entranceAngle = Math.PI / 2;
    const station = placeStation(entranceAngle);
    const ship = new Ship();
    const entrance = station.entrancePosition!;
    expect(length(entrance)).toBeGreaterThan(0);

    let blocked = false;
    station.forEachObstacle((obstacle) => {
      if (blocked) return;
      const boundary = boundaryRadiusAt(obstacle, entrance);
      if (length(sub(obstacle.position, entrance)) <= boundary + ship.radius) blocked = true;
    });
    expect(blocked).toBe(false);
  });

  it('REQ-80 has three gates and three switches, all initially closed and inactive', () => {
    const station = placeStation();
    const gates: number[] = [];
    const switches: number[] = [];
    station.forEachGate((g) => gates.push(g.index));
    station.forEachSwitch((s) => switches.push(s.index));
    expect(gates).toEqual([1, 2, 3]);
    expect(switches).toEqual([1, 2, 3]);
    expect([1, 2, 3].every((n) => !station.isGateOpen(n) && !station.isSwitchActivated(n))).toBe(true);
  });

  it('REQ-80 switch 1 is reachable from the entrance without gate 1, and each later switch only after its gate', () => {
    const station = placeStation();
    const sw = station.switchCells;
    const central = station.centralCell!;

    expect(reachable(station, sw[0], new Set())).toBe(true);
    expect(reachable(station, sw[1], new Set())).toBe(false);
    expect(reachable(station, sw[1], new Set([1]))).toBe(true);
    expect(reachable(station, sw[2], new Set())).toBe(false);
    expect(reachable(station, sw[2], new Set([1, 2]))).toBe(true);
    expect(reachable(station, central, new Set())).toBe(false);
    expect(reachable(station, central, new Set([1, 2, 3]))).toBe(true);
  });

  it('REQ-80 the central chamber is reached only once the ship arrives', () => {
    const station = placeStation();
    const ship = new Ship();
    ship.position = { ...station.entrancePosition! };
    expect(station.isCentralReached(ship)).toBe(false);
    ship.position = { ...station.centralCenter! };
    expect(station.isCentralReached(ship)).toBe(true);
  });

  it('REQ-80 activates a switch and opens its gate when the ship flies into it', () => {
    const station = placeStation();
    const ship = new Ship();
    let switch1: Vec2 | null = null;
    station.forEachSwitch((sw) => { if (sw.index === 1) switch1 = sw.position; });
    ship.position = { ...switch1! };

    station.update(0, ship, new AsteroidBelt({ x: 0, y: 0 }, []), new DroneField(), new PirateField(), new LaserField());

    expect(station.isSwitchActivated(1)).toBe(true);
    expect(station.isGateOpen(1)).toBe(true);
    expect(station.isGateOpen(2)).toBe(false);
  });

  it('REQ-80 activates a switch when any physics body — such as a regular asteroid — collides with it', () => {
    const station = placeStation();
    let switch2: Vec2 | null = null;
    station.forEachSwitch((sw) => { if (sw.index === 2) switch2 = sw.position; });
    const asteroid = new Asteroid(1, { ...switch2! }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);

    station.update(0, new Ship(), belt, new DroneField(), new PirateField(), new LaserField());

    expect(station.isSwitchActivated(2)).toBe(true);
    expect(station.isGateOpen(2)).toBe(true);
  });

  it('REQ-80 activates a switch when a laser shot reaches it', () => {
    const station = placeStation();
    const ship = new Ship();
    let switch1: Vec2 | null = null;
    station.forEachSwitch((sw) => { if (sw.index === 1) switch1 = sw.position; });
    const angle = Math.atan2(switch1!.y, switch1!.x);
    ship.position = pointOnCircle({ x: 0, y: 0 }, length(switch1!) - 60, angle);
    ship.angle = angle;
    const laserField = new LaserField();
    const belt = new AsteroidBelt({ x: 0, y: 0 }, []);
    const droneField = new DroneField();
    const pirateField = new PirateField();

    laserField.fire(ship);
    for (let step = 0; step < 40 && !station.isSwitchActivated(1); step++) {
      laserField.update(0.02, ship, belt, { forEachActive: () => undefined, boundaryRadiusAt: () => 0 } as never, 100000, droneField, pirateField, station);
      station.update(0, ship, belt, droneField, pirateField, laserField);
    }

    expect(station.isSwitchActivated(1)).toBe(true);
    expect(station.isGateOpen(1)).toBe(true);
  });

  it('REQ-80 gates stay closed until their switch is activated', () => {
    const station = placeStation();
    const ship = new Ship();
    ship.position = { x: -station.outerRadius, y: 0 };
    station.update(0, ship, new AsteroidBelt({ x: 0, y: 0 }, []), new DroneField(), new PirateField(), new LaserField());
    expect([1, 2, 3].every((n) => !station.isGateOpen(n))).toBe(true);
  });

  it('REQ-79 collectibles are supply containers that the ship can pick up', () => {
    const station = placeStation();
    const ship = new Ship();
    let pickedUp = false;
    station.addCollectablePickupObserver({ onCollectablePickup: () => { pickedUp = true; } });
    let first: Vec2 | null = null;
    let before = 0;
    station.forEachCollectible((container) => {
      if (before === 0) first = container.position;
      before++;
    });
    expect(before).toBeGreaterThan(0);
    ship.position = { ...first! };

    station.update(0.016, ship, new AsteroidBelt({ x: 0, y: 0 }, []), new DroneField(), new PirateField(), new LaserField());

    expect(pickedUp).toBe(true);
    let remaining = 0;
    station.forEachCollectible(() => remaining++);
    expect(remaining).toBe(before - 1);
  });

  it('REQ-79 the maze layout varies between seeds', () => {
    const a = placeStation(0, 1);
    const b = placeStation(0, 999);
    const machineryA: Vec2[] = [];
    const machineryB: Vec2[] = [];
    a.forEachMachinery((m) => machineryA.push(m.position));
    b.forEachMachinery((m) => machineryB.push(m.position));
    const differs = machineryA.some((p, i) => length(sub(p, machineryB[i])) > 1);
    expect(differs).toBe(true);
  });
});
