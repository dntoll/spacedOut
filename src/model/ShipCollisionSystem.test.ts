import { describe, expect, it } from 'vitest';
import { Asteroid } from './Asteroid';
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
      ship.updateLifeSupport(1);
    }
    expect(ship.isAlive).toBe(false);
    expect(ship.hp).toBe(0);
  });
});
