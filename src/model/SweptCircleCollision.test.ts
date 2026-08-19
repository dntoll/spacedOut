import { describe, expect, it } from 'vitest';
import { Ship } from './Ship';
import { ShipCollisionSystem } from './ShipCollisionSystem';
import { StationWall } from './StationWall';
import { SweptCircleCollision } from './SweptCircleCollision';
import type { Vec2 } from '../types';

describe('SweptCircleCollision.findCapsule', () => {
  it('REQ-82 stops a sweeping ship against a wall line at wallRadius + shipRadius', () => {
    const wall = new StationWall({ x: 0, y: 0 }, Math.PI / 2, 500, 26);
    const ship = new Ship();
    ship.previousPosition = { x: 0, y: 200 };
    ship.position = { x: 0, y: -200 };
    ship.velocity = { x: 0, y: -400 };

    new ShipCollisionSystem().resolve(ship, [wall], 1);

    expect(ship.position.y).toBeGreaterThan(26 + ship.radius - 1);
    expect(wall.position).toEqual({ x: 0, y: 0 });
  });

  it('REQ-82 catches the ship at the vertex sphere when sweeping past a wall endpoint (no slip-through)', () => {
    const wall = new StationWall({ x: 0, y: 0 }, Math.PI / 2, 500, 26);
    const endY = 500;
    const ship = new Ship();
    ship.previousPosition = { x: 0, y: endY + 200 };
    ship.position = { x: 0, y: endY - 200 };
    ship.velocity = { x: 0, y: -400 };

    new ShipCollisionSystem().resolve(ship, [wall], 1);

    expect(ship.position.y).toBeGreaterThanOrEqual(endY + 26 + ship.radius - 1);
  });

  it('REQ-82 does not false-hit when the ship sweeps parallel to the wall beyond the combined radius', () => {
    const wall = new StationWall({ x: 0, y: 0 }, 0, 500, 26);
    const ship = new Ship();
    const safeY = 26 + ship.radius + 50;
    ship.previousPosition = { x: -600, y: safeY };
    ship.position = { x: 600, y: safeY };
    ship.velocity = { x: 1200, y: 0 };

    new ShipCollisionSystem().resolve(ship, [wall], 1);

    expect(ship.position.x).toBeCloseTo(600, 0);
    expect(ship.position.y).toBeCloseTo(safeY, 0);
  });

  it('REQ-82 seals the corner where two perpendicular walls share an endpoint', () => {
    const horizontal = new StationWall({ x: 250, y: 0 }, 0, 250, 26);
    const vertical = new StationWall({ x: 0, y: 250 }, Math.PI / 2, 250, 26);
    const ship = new Ship();
    ship.previousPosition = { x: 300, y: 300 };
    ship.position = { x: -50, y: -50 };
    ship.velocity = { x: -350, y: -350 };

    new ShipCollisionSystem().resolve(ship, [horizontal, vertical], 1);

    expect(ship.position.x).toBeGreaterThanOrEqual(26 + ship.radius - 2);
    expect(ship.position.y).toBeGreaterThanOrEqual(26 + ship.radius - 2);
  });

  it('REQ-82 findCapsule returns undefined when the path never reaches the capsule', () => {
    const wall = new StationWall({ x: 0, y: 0 }, 0, 500, 26);
    const start: Vec2 = { x: 0, y: 500 };
    const end: Vec2 = { x: 100, y: 500 };
    expect(SweptCircleCollision.findCapsule(start, end, 18, wall)).toBeUndefined();
  });
});
