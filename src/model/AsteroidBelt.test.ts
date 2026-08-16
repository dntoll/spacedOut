import { describe, expect, it } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { CollisionResolver } from './CollisionResolver';
import { Ship } from './Ship';
import { ShipCollisionSystem } from './ShipCollisionSystem';

describe('AsteroidBelt', () => {
  it('REQ-11 creates a randomized field of asteroids', () => {
    const asteroids: Asteroid[] = [];
    new AsteroidBelt({ x: 0, y: 0 }).forEach((asteroid) => asteroids.push(asteroid));
    expect(asteroids).toHaveLength(34);
    expect(new Set(asteroids.map((asteroid) => asteroid.radius)).size).toBeGreaterThan(1);
    expect(new Set(asteroids.map((asteroid) => `${asteroid.position.x},${asteroid.position.y}`)).size).toBeGreaterThan(1);
  });

  it('REQ-25 recycles asteroids beyond the visible boundary used at high speed', () => {
    const asteroid = new Asteroid(1, { x: 10000, y: 0 }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);

    belt.update(0, { x: 0, y: 0 }, 3000);

    const positions: number[] = [];
    belt.forEach((body) => positions.push(Math.hypot(body.position.x, body.position.y)));
    expect(positions[0]).toBeGreaterThan(3000);
  });

  it('REQ-12 transfers momentum and spin during ship-asteroid collisions', () => {
    const ship = new Ship();
    ship.previousPosition = { x: 70, y: 0 };
    ship.position = { x: 0, y: 0 };
    ship.velocity = { x: -70, y: 20 };
    const asteroid = new Asteroid(1, { x: 0, y: 0 }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1, 1, 1, 1], 0.5);
    const collisions: unknown[] = [];
    const system = new ShipCollisionSystem();
    system.addCollisionObserver({ onCollision: (collision) => collisions.push(collision) });

    system.resolve(ship, [asteroid], 1);

    expect(ship.velocity.x).toBeGreaterThan(-70);
    expect(asteroid.velocity.x).toBeLessThan(0);
    expect(asteroid.angularVelocity).not.toBe(0);
    expect(collisions).toHaveLength(1);
  });

  it('REQ-12 uses scale-based mass to push small asteroids while large asteroids can reverse the ship', () => {
    const collideWith = (radius: number) => {
      const ship = new Ship();
      ship.position = { x: 0, y: 0 };
      ship.velocity = { x: 100, y: 0 };
      const asteroid = new Asteroid(
        radius, { x: ship.radius + radius - 1, y: 0 }, { x: 0, y: 0 },
        radius, 0, 0, [1, 1, 1, 1, 1, 1], 0.5,
      );
      CollisionResolver.resolve(ship, asteroid);
      return { ship, asteroid };
    };

    const small = collideWith(20);
    const large = collideWith(55);

    expect(small.asteroid.mass).toBeLessThan(small.ship.mass);
    expect(small.ship.velocity.x).toBeGreaterThan(0);
    expect(small.asteroid.velocity.x).toBeGreaterThan(small.ship.velocity.x);
    expect(large.asteroid.mass).toBeGreaterThan(large.ship.mass);
    expect(large.ship.velocity.x).toBeLessThan(0);
  });
});
