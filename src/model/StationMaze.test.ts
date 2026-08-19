import { describe, expect, it } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { DroneField } from './DroneField';
import { LaserField } from './LaserField';
import { MassiveAsteroid } from './MassiveAsteroid';
import { PirateField } from './PirateField';
import { Ship } from './Ship';
import { StationMaze } from './StationMaze';
import { pointOnCircle } from './StationGeometry';
import { isCapsuleObstacle } from './SweptCircleCollision';
import { closestPointOnSegment, length, sub } from '../math';
import type { Vec2 } from '../types';

const STATION_RADIUS = 1000;
const placeStation = (entranceAngle = 0, seed = 42): StationMaze => {
  const maze = new StationMaze();
  maze.placeAt({ x: 0, y: 0 }, STATION_RADIUS, entranceAngle, seed);
  return maze;
};

const reachable = (maze: StationMaze, target: { c: number; r: number }, openGates: ReadonlySet<number>): boolean => {
  const carver = maze.carver!;
  const n = carver.gridN;
  const bitmap = carver.bitmap;
  const start = maze.entranceCell!;
  const blocked = new Set<string>();
  for (let i = 1; i <= 3; i++) if (!openGates.has(i)) for (const cell of maze.gateCells(i)) blocked.add(`${cell.c},${cell.r}`);
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

describe('StationMaze', () => {
  it('REQ-79 builds a maze-scale station with an entrance, central chamber, walls, machinery, and collectibles', () => {
    const ship = new Ship();
    const maze = placeStation();
    expect(maze.isPlaced).toBe(true);
    expect(maze.outerRadius).toBeGreaterThanOrEqual(ship.radius * 30);
    expect(maze.entrancePosition).not.toBeNull();
    expect(maze.centralCenter).not.toBeNull();
    expect(maze.centralRadius).toBeGreaterThan(0);

    let wallCount = 0;
    let machineryCount = 0;
    let collectibleCount = 0;
    maze.forEachWall(() => wallCount++);
    maze.forEachMachinery(() => machineryCount++);
    maze.forEachCollectible(() => collectibleCount++);
    expect(wallCount).toBeGreaterThan(20);
    expect(machineryCount).toBeGreaterThan(0);
    expect(collectibleCount).toBeGreaterThan(0);
  });

  it('REQ-79 walls are immovable capsule obstacles and machinery are immovable massive-asteroid obstacles', () => {
    const maze = placeStation();
    let wallSeen = false;
    maze.forEachWall((wall) => {
      wallSeen = true;
      expect(wall).toBeInstanceOf(MassiveAsteroid);
      expect(wall.mass).toBe(Number.POSITIVE_INFINITY);
      expect(wall.velocity).toEqual({ x: 0, y: 0 });
      expect(isCapsuleObstacle(wall)).toBe(true);
      expect(length(sub(wall.a, wall.b))).toBeGreaterThan(0);
    });
    expect(wallSeen).toBe(true);
    maze.forEachMachinery((m) => {
      expect(m).toBeInstanceOf(MassiveAsteroid);
      expect(m.mass).toBe(Number.POSITIVE_INFINITY);
    });
  });

  it('REQ-79 has a single exterior entrance gap the ship can fly through', () => {
    const entranceAngle = Math.PI / 2;
    const maze = placeStation(entranceAngle);
    const ship = new Ship();
    const entrance = maze.entrancePosition!;
    expect(length(entrance)).toBeGreaterThan(0);

    let blocked = false;
    maze.forEachObstacle((obstacle) => {
      if (blocked) return;
      if (isCapsuleObstacle(obstacle)) {
        const closest = closestPointOnSegment(entrance, obstacle.a, obstacle.b);
        if (length(sub(closest, entrance)) <= obstacle.wallRadius + ship.radius) blocked = true;
      } else {
        const boundary = MassiveAsteroid.boundaryRadiusAt(obstacle, entrance);
        if (length(sub(obstacle.position, entrance)) <= boundary + ship.radius) blocked = true;
      }
    });
    expect(blocked).toBe(false);
  });

  it('REQ-80 has three gates and three switches, all initially closed and inactive', () => {
    const maze = placeStation();
    const gates: number[] = [];
    const switches: number[] = [];
    maze.forEachGate((g) => gates.push(g.index));
    maze.forEachSwitch((s) => switches.push(s.index));
    expect(gates).toEqual([1, 2, 3]);
    expect(switches).toEqual([1, 2, 3]);
    expect([1, 2, 3].every((n) => !maze.isGateOpen(n) && !maze.isSwitchActivated(n))).toBe(true);
  });

  it('REQ-80 switch 1 is reachable from the entrance without gate 1, and each later switch only after its gate', () => {
    const maze = placeStation();
    const sw = maze.switchCells;
    const central = maze.centralCell!;

    expect(reachable(maze, sw[0], new Set())).toBe(true);
    expect(reachable(maze, sw[1], new Set())).toBe(false);
    expect(reachable(maze, sw[1], new Set([1]))).toBe(true);
    expect(reachable(maze, sw[2], new Set())).toBe(false);
    expect(reachable(maze, sw[2], new Set([1, 2]))).toBe(true);
    expect(reachable(maze, central, new Set())).toBe(false);
    expect(reachable(maze, central, new Set([1, 2, 3]))).toBe(true);
  });

  it('REQ-80 the central chamber is reached only once the ship arrives', () => {
    const maze = placeStation();
    const ship = new Ship();
    ship.position = { ...maze.entrancePosition! };
    expect(maze.isCentralReached(ship)).toBe(false);
    ship.position = { ...maze.centralCenter! };
    expect(maze.isCentralReached(ship)).toBe(true);
  });

  it('REQ-80 activates a switch and opens its gate when the ship flies into it', () => {
    const maze = placeStation();
    const ship = new Ship();
    let switch1: Vec2 | null = null;
    maze.forEachSwitch((sw) => { if (sw.index === 1) switch1 = sw.position; });
    ship.position = { ...switch1! };

    maze.update(0, ship, new AsteroidBelt({ x: 0, y: 0 }, []), new DroneField(), new PirateField(), new LaserField());

    expect(maze.isSwitchActivated(1)).toBe(true);
    expect(maze.isGateOpen(1)).toBe(true);
    expect(maze.isGateOpen(2)).toBe(false);
  });

  it('REQ-80 activates a switch when any physics body — such as a regular asteroid — collides with it', () => {
    const maze = placeStation();
    let switch2: Vec2 | null = null;
    maze.forEachSwitch((sw) => { if (sw.index === 2) switch2 = sw.position; });
    const asteroid = new Asteroid(1, { ...switch2! }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);

    maze.update(0, new Ship(), belt, new DroneField(), new PirateField(), new LaserField());

    expect(maze.isSwitchActivated(2)).toBe(true);
    expect(maze.isGateOpen(2)).toBe(true);
  });

  it('REQ-80 activates a switch when a laser shot reaches it', () => {
    const maze = placeStation();
    const ship = new Ship();
    let switch1: Vec2 | null = null;
    maze.forEachSwitch((sw) => { if (sw.index === 1) switch1 = sw.position; });
    const angle = Math.atan2(switch1!.y, switch1!.x);
    ship.position = pointOnCircle({ x: 0, y: 0 }, length(switch1!) - 60, angle);
    ship.angle = angle;
    const laserField = new LaserField();
    const belt = new AsteroidBelt({ x: 0, y: 0 }, []);
    const droneField = new DroneField();
    const pirateField = new PirateField();

    laserField.fire(ship);
    for (let step = 0; step < 40 && !maze.isSwitchActivated(1); step++) {
      laserField.update(0.02, ship, belt, { forEachActive: () => undefined, boundaryRadiusAt: () => 0 } as never, 100000, droneField, pirateField, maze);
      maze.update(0, ship, belt, droneField, pirateField, laserField);
    }

    expect(maze.isSwitchActivated(1)).toBe(true);
    expect(maze.isGateOpen(1)).toBe(true);
  });

  it('REQ-80 gates stay closed until their switch is activated', () => {
    const maze = placeStation();
    const ship = new Ship();
    ship.position = { x: -maze.outerRadius, y: 0 };
    maze.update(0, ship, new AsteroidBelt({ x: 0, y: 0 }, []), new DroneField(), new PirateField(), new LaserField());
    expect([1, 2, 3].every((n) => !maze.isGateOpen(n))).toBe(true);
  });

  it('REQ-79 collectibles are supply containers that the ship can pick up', () => {
    const maze = placeStation();
    const ship = new Ship();
    let pickedUp = false;
    maze.addCollectablePickupObserver({ onCollectablePickup: () => { pickedUp = true; } });
    let first: Vec2 | null = null;
    let before = 0;
    maze.forEachCollectible((container) => {
      if (before === 0) first = container.position;
      before++;
    });
    expect(before).toBeGreaterThan(0);
    ship.position = { ...first! };

    maze.update(0.016, ship, new AsteroidBelt({ x: 0, y: 0 }, []), new DroneField(), new PirateField(), new LaserField());

    expect(pickedUp).toBe(true);
    let remaining = 0;
    maze.forEachCollectible(() => remaining++);
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
