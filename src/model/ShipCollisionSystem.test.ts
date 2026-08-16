import { describe, expect, it } from 'vitest';
import { MassiveAsteroid } from './MassiveAsteroid';
import { Ship } from './Ship';
import { ShipCollisionSystem } from './ShipCollisionSystem';

const squareAsteroid = (id: number, x = 0, y = 0, radius = 50) => new MassiveAsteroid(
  id, { x, y }, radius, 0, [1, 1, 1, 1], [], 0.5,
);

describe('ShipCollisionSystem', () => {
  it('REQ-22 sweeps the ship center against radius-expanded edges without penetration', () => {
    const obstacle = squareAsteroid(1);
    const ship = new Ship();
    ship.previousPosition = { x: 100, y: 0 };
    ship.position = { x: -100, y: 0 };
    ship.velocity = { x: -200, y: 0 };

    new ShipCollisionSystem().resolve(ship, [obstacle], 1);

    expect(ship.position.x).toBeGreaterThan(50 + ship.radius);
    expect(ship.velocity.x).toBeGreaterThan(0);
  });

  it('REQ-22 collides with the ship-radius sphere around an original polygon corner', () => {
    const obstacle = squareAsteroid(1);
    const ship = new Ship();
    ship.previousPosition = { x: 100, y: 0 };
    ship.position = { x: 40, y: 0 };
    ship.velocity = { x: -60, y: 0 };

    new ShipCollisionSystem().resolve(ship, [obstacle], 1);

    expect(ship.position.x).toBeGreaterThanOrEqual(50 + ship.radius);
  });

  it('REQ-22 resolves simultaneous contacts using their combined normals', () => {
    const first = squareAsteroid(1, 0, 50, 30);
    const second = squareAsteroid(2, 50, 0, 30);
    const ship = new Ship();
    ship.previousPosition = { x: 100, y: 100 };
    ship.position = { x: 0, y: 0 };
    ship.velocity = { x: -100, y: -100 };
    const collisions: unknown[] = [];
    const system = new ShipCollisionSystem();
    system.addCollisionObserver({ onCollision: (collision) => collisions.push(collision) });

    system.resolve(ship, [first, second], 1);

    expect(collisions).toHaveLength(2);
    expect(ship.position.x).toBeCloseTo(ship.position.y, 3);
    expect(Number.isFinite(ship.position.x)).toBe(true);
  });
});
