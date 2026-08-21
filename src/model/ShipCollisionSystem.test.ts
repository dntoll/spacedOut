import { describe, expect, it } from 'vitest';
import { Asteroid } from './Asteroid';
import { MassiveAsteroid } from './MassiveAsteroid';
import { Ship } from './Ship';
import { ShipCollisionSystem } from './ShipCollisionSystem';
import { StationWall } from './StationWall';

const squareAsteroid = (id: number, x = 0, y = 0, radius = 50) => new MassiveAsteroid(
  id, { x, y }, radius, 0, [1, 1, 1, 1], [], 0.5,
);

describe('ShipCollisionSystem', () => {
  it('REQ-64 collides with the station hull while the hull remains fixed', () => {
    const wall = new StationWall({ x: 1000, y: 0 }, Math.PI / 2, 500, 26);
    const ship = new Ship();
    ship.previousPosition = { x: 1200, y: 0 };
    ship.position = { x: 900, y: 0 };
    ship.velocity = { x: -300, y: 0 };

    new ShipCollisionSystem().resolve(ship, [wall], 1);

    expect(ship.position.x).toBeGreaterThan(1000);
    expect(ship.velocity.x).toBeGreaterThan(0);
    expect(wall.position).toEqual({ x: 1000, y: 0 });
    expect(wall.velocity).toEqual({ x: 0, y: 0 });
  });

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

    // A corner hit resolves as a single combined-normal contact (one impulse),
    // so restitution is applied once rather than summed across both faces.
    expect(collisions).toHaveLength(1);
    expect(ship.position.x).toBeCloseTo(ship.position.y, 3);
    expect(Number.isFinite(ship.position.x)).toBe(true);
  });

  it('REQ-82 does not add speed when the ship bounces into a 90 degree corner', () => {
    // Two perpendicular walls meeting at the origin form a corner. The ship is
    // driven diagonally into it; a summed-impulse corner would boost the speed
    // (restitution applied per face). A single combined impulse must not.
    const horizontal = new StationWall({ x: 250, y: 0 }, 0, 250, 26);
    const vertical = new StationWall({ x: 0, y: 250 }, Math.PI / 2, 250, 26);
    const ship = new Ship();
    ship.previousPosition = { x: 300, y: 300 };
    ship.position = { x: 40, y: 40 };
    ship.velocity = { x: -260, y: -260 };
    const incomingSpeed = Math.hypot(ship.velocity.x, ship.velocity.y);

    new ShipCollisionSystem().resolve(ship, [horizontal, vertical], 1);

    const outgoingSpeed = Math.hypot(ship.velocity.x, ship.velocity.y);
    expect(outgoingSpeed).toBeLessThanOrEqual(incomingSpeed + 1);
  });

  it('REQ-33 does not damage the ship below the violent impact threshold', () => {
    const obstacle = squareAsteroid(1);
    const ship = new Ship();
    ship.previousPosition = { x: 100, y: 0 };
    ship.position = { x: -100, y: 0 };
    ship.velocity = { x: -200, y: 0 };

    new ShipCollisionSystem().resolve(ship, [obstacle], 1);

    expect(ship.hp).toBe(100);
  });

  it('REQ-33 damages the ship on violent impacts, more from massive than regular asteroids', () => {
    const massive = squareAsteroid(1, 0, 0, 50);
    const massiveShip = new Ship();
    massiveShip.previousPosition = { x: 100, y: 0 };
    massiveShip.position = { x: -100, y: 0 };
    massiveShip.velocity = { x: -600, y: 0 };
    new ShipCollisionSystem().resolve(massiveShip, [massive], 1);
    const massiveDamage = 100 - massiveShip.hp;
    expect(massiveDamage).toBeGreaterThan(0);

    const regular = new Asteroid(2, { x: 0, y: 0 }, { x: 0, y: 0 }, 50, 0, 0, [1, 1, 1, 1], 0.5);
    const regularShip = new Ship();
    regularShip.previousPosition = { x: 100, y: 0 };
    regularShip.position = { x: -100, y: 0 };
    regularShip.velocity = { x: -600, y: 0 };
    new ShipCollisionSystem().resolve(regularShip, [regular], 1);
    const regularDamage = 100 - regularShip.hp;
    expect(regularDamage).toBeGreaterThan(0);
    expect(massiveDamage).toBeGreaterThan(regularDamage);
  });

  it('REQ-35 grants invulnerability that blocks damage from an immediate second hit', () => {
    const obstacle = squareAsteroid(1);
    const ship = new Ship();
    ship.previousPosition = { x: 100, y: 0 };
    ship.position = { x: -100, y: 0 };
    ship.velocity = { x: -600, y: 0 };
    const system = new ShipCollisionSystem();
    system.resolve(ship, [obstacle], 1);
    const hpAfterFirst = ship.hp;
    expect(hpAfterFirst).toBeLessThan(100);

    ship.previousPosition = { x: 100, y: 0 };
    ship.position = { x: -100, y: 0 };
    ship.velocity = { x: -600, y: 0 };
    system.resolve(ship, [obstacle], 1);

    expect(ship.hp).toBe(hpAfterFirst);
  });

  it('REQ-36 destroys the ship when collisions drain hit-points to zero', () => {
    const obstacle = squareAsteroid(1);
    const ship = new Ship();
    const system = new ShipCollisionSystem();
    for (let hit = 0; hit < 6 && ship.isAlive; hit++) {
      ship.previousPosition = { x: 100, y: 0 };
      ship.position = { x: -100, y: 0 };
      ship.velocity = { x: -2000, y: 0 };
      system.resolve(ship, [obstacle], 1);
      ship.updateInvulnerability(1);
    }
    expect(ship.isAlive).toBe(false);
    expect(ship.hp).toBe(0);
  });
});
