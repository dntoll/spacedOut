import { describe, expect, it } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { Ship } from './Ship';

describe('AsteroidBelt', () => {
  it('REQ-11 creates a randomized field of asteroids', () => {
    const asteroids: Asteroid[] = [];
    new AsteroidBelt({ x: 0, y: 0 }).forEach((asteroid) => asteroids.push(asteroid));
    expect(asteroids).toHaveLength(34);
    expect(new Set(asteroids.map((asteroid) => asteroid.radius)).size).toBeGreaterThan(1);
    expect(new Set(asteroids.map((asteroid) => `${asteroid.position.x},${asteroid.position.y}`)).size).toBeGreaterThan(1);
  });

  it('REQ-12 transfers momentum and spin during ship-asteroid collisions', () => {
    const ship = new Ship();
    ship.velocity = { x: 50, y: 20 };
    const asteroid = new Asteroid(1, { x: 25, y: 0 }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const collisions: unknown[] = [];
    belt.addCollisionObserver({ onCollision: (collision) => collisions.push(collision) });

    belt.update(0, ship);

    expect(ship.velocity.x).toBeLessThan(50);
    expect(asteroid.velocity.x).toBeGreaterThan(0);
    expect(asteroid.angularVelocity).not.toBe(0);
    expect(collisions).toHaveLength(1);
  });
});
