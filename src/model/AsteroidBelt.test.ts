import { describe, expect, it, vi } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { AsteroidDestroyed } from './AsteroidDestroyed';
import { AsteroidTier } from './AsteroidTier';
import { Collision } from './Collision';
import { CollisionResolver } from './CollisionResolver';
import { Ship } from './Ship';
import { ShipCollisionSystem } from './ShipCollisionSystem';

describe('AsteroidBelt', () => {
  it('REQ-11 creates a randomized field of asteroids', () => {
    const asteroids: Asteroid[] = [];
    new AsteroidBelt({ x: 0, y: 0 }).forEach((asteroid) => asteroids.push(asteroid));
    expect(asteroids).toHaveLength(60);
    expect(new Set(asteroids.map((asteroid) => asteroid.radius)).size).toBeGreaterThan(1);
    expect(new Set(asteroids.map((asteroid) => `${asteroid.position.x},${asteroid.position.y}`)).size).toBeGreaterThan(1);
  });

  it('REQ-11 weights asteroid spawning toward the small tier', () => {
    const spy = vi.spyOn(Math, 'random');
    spy.mockReturnValue(0);
    expect(AsteroidBelt.tierOf(AsteroidBelt.pickRadius())).toBe(AsteroidTier.Small);
    spy.mockReturnValue(0.49);
    expect(AsteroidBelt.tierOf(AsteroidBelt.pickRadius())).toBe(AsteroidTier.Small);
    spy.mockReturnValue(0.5);
    expect(AsteroidBelt.tierOf(AsteroidBelt.pickRadius())).toBe(AsteroidTier.Medium);
    spy.mockReturnValue(0.79);
    expect(AsteroidBelt.tierOf(AsteroidBelt.pickRadius())).toBe(AsteroidTier.Medium);
    spy.mockReturnValue(0.8);
    expect(AsteroidBelt.tierOf(AsteroidBelt.pickRadius())).toBe(AsteroidTier.Large);
    spy.mockRestore();
  });

  it('REQ-25 recycles asteroids beyond the visible boundary used at high speed', () => {
    const asteroid = new Asteroid(1, { x: 10000, y: 0 }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);

    belt.update(0, { x: 0, y: 0 }, 3000);

    const positions: number[] = [];
    belt.forEach((body) => positions.push(Math.hypot(body.position.x, body.position.y)));
    expect(positions[0]).toBeGreaterThan(3000);
  });

  it('REQ-62 recycles distant asteroids and spawns dense islands ahead while traversing', () => {
    const asteroids: Asteroid[] = [];
    for (let i = 0; i < 60; i++) {
      asteroids.push(new Asteroid(i, { x: 10000 + i * 100, y: 0 }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5));
    }
    const belt = new AsteroidBelt({ x: 0, y: 0 }, asteroids);

    belt.update(0, { x: 0, y: 0 }, 1500, true, true, { x: 1, y: 0 });

    const remaining: Asteroid[] = [];
    belt.forEach((body) => remaining.push(body));
    expect(remaining.length).toBeGreaterThanOrEqual(10);
    expect(remaining.length).toBeLessThanOrEqual(100);
    const ahead = remaining.filter((a) => a.position.x > 2000);
    expect(ahead.length).toBeGreaterThanOrEqual(10);
  });

  it('REQ-62 retains the spawned island across frames until the ship reaches it', () => {
    const belt = new AsteroidBelt({ x: 0, y: 0 }, []);
    const direction = { x: 1, y: 0 };

    belt.update(0, { x: 0, y: 0 }, 1500, true, true, direction);
    const afterFirst: Asteroid[] = [];
    belt.forEach((a) => afterFirst.push(a));
    expect(afterFirst.length).toBeGreaterThanOrEqual(10);

    for (let step = 0; step < 10; step++) belt.update(0, { x: 0, y: 0 }, 1500, true, true, direction);
    const afterLater: Asteroid[] = [];
    belt.forEach((a) => afterLater.push(a));

    expect(afterLater.length).toBeGreaterThanOrEqual(10);
  });

  it('REQ-62 exposes an irregular warning outline around each spawned island', () => {
    const belt = new AsteroidBelt({ x: 0, y: 0 }, []);
    belt.update(0, { x: 0, y: 0 }, 1500, true, true, { x: 1, y: 0 });

    const islands: { center: { x: number; y: number }; radius: number; outline: { x: number; y: number }[] }[] = [];
    belt.forEachIsland((island) => islands.push(island));

    expect(islands.length).toBeGreaterThan(0);
    expect(islands[0].radius).toBeGreaterThan(500);
    expect(islands[0].outline.length).toBeGreaterThanOrEqual(12);
    const center = islands[0].center;
    const radii = islands[0].outline.map((p) => Math.hypot(p.x - center.x, p.y - center.y));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(120);
  });

  it('REQ-62 spawns some islands peripherally off the route so they can be skipped', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, []);
    belt.update(0, { x: 0, y: 0 }, 1500, true, true, { x: 1, y: 0 });
    spy.mockRestore();

    const islands: { center: { x: number; y: number } }[] = [];
    belt.forEachIsland((island) => islands.push(island));
    expect(islands.length).toBeGreaterThan(0);
    expect(Math.abs(islands[0].center.y)).toBeGreaterThan(500);
  });

  it('REQ-62 leaves wide randomized spacing between islands', () => {
    const belt = new AsteroidBelt({ x: 0, y: 0 }, []);
    belt.update(0, { x: 0, y: 0 }, 1500, true, true, { x: 1, y: 0 });
    let islands: { center: { x: number; y: number } }[] = [];
    belt.forEachIsland((island) => islands.push(island));
    expect(islands.length).toBe(1);

    // advancing well within the wide gap does not spawn another island
    belt.update(0, { x: 10000, y: 0 }, 1500, true, true, { x: 1, y: 0 });
    islands = [];
    belt.forEachIsland((island) => islands.push(island));
    expect(islands.length).toBe(1);
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

  it('REQ-41 classifies regular asteroids into small, medium, and large tiers by radius', () => {
    expect(AsteroidBelt.tierOf(20)).toBe(AsteroidTier.Small);
    expect(AsteroidBelt.tierOf(38)).toBe(AsteroidTier.Medium);
    expect(AsteroidBelt.tierOf(50)).toBe(AsteroidTier.Large);
  });

  it('REQ-41 splits a large asteroid into two medium asteroids on a laser hit', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const asteroid = new Asteroid(1, { x: 0, y: 0 }, { x: 0, y: 0 }, 50, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const events: AsteroidDestroyed[] = [];
    belt.addAsteroidDestroyedObserver({ onDestroyed: (event) => events.push(event) });

    belt.applyLaserHit(asteroid, { x: 0, y: 0 });

    const remaining: Asteroid[] = [];
    belt.forEach((body) => remaining.push(body));
    expect(remaining).toHaveLength(2);
    expect(remaining.every((body) => AsteroidBelt.tierOf(body.radius) === AsteroidTier.Medium)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].tier).toBe(AsteroidTier.Large);
    spy.mockRestore();
  });

  it('REQ-41 splits a medium asteroid into two small asteroids on a laser hit', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const asteroid = new Asteroid(1, { x: 0, y: 0 }, { x: 0, y: 0 }, 38, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);

    belt.applyLaserHit(asteroid, { x: 0, y: 0 });

    const remaining: Asteroid[] = [];
    belt.forEach((body) => remaining.push(body));
    expect(remaining).toHaveLength(2);
    expect(remaining.every((body) => AsteroidBelt.tierOf(body.radius) === AsteroidTier.Small)).toBe(true);
    spy.mockRestore();
  });

  it('REQ-41 explodes the smallest asteroid without splitting on a laser hit', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const asteroid = new Asteroid(1, { x: 0, y: 0 }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const events: AsteroidDestroyed[] = [];
    belt.addAsteroidDestroyedObserver({ onDestroyed: (event) => events.push(event) });

    belt.applyLaserHit(asteroid, { x: 0, y: 0 });

    const remaining: Asteroid[] = [];
    belt.forEach((body) => remaining.push(body));
    expect(remaining).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0].tier).toBe(AsteroidTier.Small);
    spy.mockRestore();
  });

  it('REQ-45 emits an AsteroidCollision when two asteroids collide', () => {
    const a = new Asteroid(1, { x: 0, y: 0 }, { x: 10, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const b = new Asteroid(2, { x: 5, y: 0 }, { x: -10, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [a, b]);
    const events: Collision[] = [];
    belt.addAsteroidCollisionObserver({ onAsteroidCollision: (collision) => events.push(collision) });

    belt.update(0, { x: 0, y: 0 }, 100000);

    expect(events.length).toBeGreaterThan(0);
  });
});
