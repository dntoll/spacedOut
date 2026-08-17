import { add, length, random, scale, sub } from '../math';
import type { Vec2 } from '../types';
import { Asteroid } from './Asteroid';
import { AsteroidDestroyed } from './AsteroidDestroyed';
import type { AsteroidDestroyedObserver } from './AsteroidDestroyedObserver';
import type { AsteroidCollisionObserver } from './AsteroidCollisionObserver';
import { AsteroidTier } from './AsteroidTier';
import { Collision } from './Collision';
import type { CollisionObserver } from './CollisionObserver';
import { CollisionResolver } from './CollisionResolver';
import type { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';

const SMALL_MAX_RADIUS = 30;
const MEDIUM_MAX_RADIUS = 46;
const SPLIT_PROBABILITY = 0.7;
const SMALL_WEIGHT = 0.5;
const MEDIUM_WEIGHT = 0.3;

export class AsteroidBelt {
  private readonly asteroids: Asteroid[] = [];
  private readonly collisionObservers = new Set<CollisionObserver>();
  private readonly asteroidCollisionObservers = new Set<AsteroidCollisionObserver>();
  private readonly destructionObservers = new Set<AsteroidDestroyedObserver>();
  private nextId = 0;

  constructor(center: Vec2, initialAsteroids?: Asteroid[]) {
    if (initialAsteroids) {
      this.asteroids.push(...initialAsteroids);
      return;
    }
    for (let i = 0; i < 34; i++) {
      this.asteroids.push(this.createAsteroid(center, i < 8 ? 260 : 500, 1600));
    }
  }

  update(dt: number, center: Vec2, spawnExclusionRadius = 1450): void {
    for (const asteroid of this.asteroids) {
      asteroid.integrate(dt);
    }
    this.resolveInternalCollisions();
    this.recycleDistantAsteroids(center, spawnExclusionRadius);
  }

  forEach(visitor: (asteroid: Asteroid) => void): void {
    this.asteroids.forEach(visitor);
  }

  collideWith(body: PhysicsBody): void {
    for (const asteroid of this.asteroids) this.collide(body, asteroid);
  }

  addCollisionObserver(observer: CollisionObserver): void {
    this.collisionObservers.add(observer);
  }

  removeCollisionObserver(observer: CollisionObserver): void {
    this.collisionObservers.delete(observer);
  }

  addAsteroidCollisionObserver(observer: AsteroidCollisionObserver): void {
    this.asteroidCollisionObservers.add(observer);
  }

  removeAsteroidCollisionObserver(observer: AsteroidCollisionObserver): void {
    this.asteroidCollisionObservers.delete(observer);
  }

  addAsteroidDestroyedObserver(observer: AsteroidDestroyedObserver): void {
    this.destructionObservers.add(observer);
  }

  removeAsteroidDestroyedObserver(observer: AsteroidDestroyedObserver): void {
    this.destructionObservers.delete(observer);
  }

  static tierOf(radius: number): AsteroidTier {
    if (radius < SMALL_MAX_RADIUS) return AsteroidTier.Small;
    if (radius < MEDIUM_MAX_RADIUS) return AsteroidTier.Medium;
    return AsteroidTier.Large;
  }

  static pickRadius(): number {
    const roll = Math.random();
    if (roll < SMALL_WEIGHT) return random(20, SMALL_MAX_RADIUS);
    if (roll < SMALL_WEIGHT + MEDIUM_WEIGHT) return random(SMALL_MAX_RADIUS, MEDIUM_MAX_RADIUS);
    return random(MEDIUM_MAX_RADIUS, 62);
  }

  applyLaserHit(asteroid: Asteroid, position: Vec2): void {
    const index = this.asteroids.findIndex((candidate) => candidate === asteroid);
    if (index < 0) return;
    this.asteroids.splice(index, 1);

    const tier = AsteroidBelt.tierOf(asteroid.radius);
    if (tier !== AsteroidTier.Small && Math.random() < SPLIT_PROBABILITY) {
      this.spawnFragments(asteroid, tier);
    }

    const event = new AsteroidDestroyed({ ...position }, tier);
    for (const observer of this.destructionObservers) observer.onDestroyed(event);
  }

  private createAsteroid(center: Vec2, minDistance: number, maxDistance: number): Asteroid {
    const direction = random(0, Math.PI * 2);
    const distance = random(minDistance, maxDistance);
    const radius = AsteroidBelt.pickRadius();
    const vertexCount = Math.floor(random(8, 13));
    return new Asteroid(
      this.nextId++,
      add(center, { x: Math.cos(direction) * distance, y: Math.sin(direction) * distance }),
      { x: random(-16, 16), y: random(-16, 16) },
      radius,
      random(0, Math.PI * 2),
      random(-0.22, 0.22),
      Array.from({ length: vertexCount }, () => random(0.78, 1.12)),
      random(0, 1),
    );
  }

  private spawnFragments(parent: Asteroid, tier: AsteroidTier): void {
    const childRadius = tier === AsteroidTier.Large
      ? random(SMALL_MAX_RADIUS, MEDIUM_MAX_RADIUS)
      : random(20, SMALL_MAX_RADIUS);
    const speed = length(parent.velocity);
    const axis = speed > 0.001 ? scale(parent.velocity, 1 / speed) : { x: 1, y: 0 };
    const perpendicular = { x: -axis.y, y: axis.x };
    const spread = 40;
    for (const sign of [1, -1]) {
      const offset = scale(perpendicular, sign * childRadius);
      const velocity = add(parent.velocity, scale(perpendicular, sign * spread));
      const vertexCount = Math.floor(random(8, 13));
      this.asteroids.push(new Asteroid(
        this.nextId++,
        add(parent.position, offset),
        velocity,
        childRadius,
        random(0, Math.PI * 2),
        random(-0.22, 0.22),
        Array.from({ length: vertexCount }, () => random(0.78, 1.12)),
        random(0, 1),
      ));
    }
  }

  private recycleDistantAsteroids(center: Vec2, spawnExclusionRadius: number): void {
    const spawnInnerRadius = Math.max(1050, spawnExclusionRadius + 180);
    const recycleRadius = spawnInnerRadius + 800;
    for (let i = 0; i < this.asteroids.length; i++) {
      if (length(sub(this.asteroids[i].position, center)) > recycleRadius) {
        this.asteroids[i] = this.createAsteroid(center, spawnInnerRadius, spawnInnerRadius + 500);
      }
    }
  }

  private resolveInternalCollisions(): void {
    for (let i = 0; i < this.asteroids.length; i++) {
      for (let j = i + 1; j < this.asteroids.length; j++) {
        const a = this.asteroids[i];
        const b = this.asteroids[j];
        if (
          Math.abs(a.position.x - b.position.x) < a.radius + b.radius
          && Math.abs(a.position.y - b.position.y) < a.radius + b.radius
        ) {
          const collision = this.collide(a, b);
          if (collision) {
            for (const observer of this.asteroidCollisionObservers) observer.onAsteroidCollision(collision);
          }
        }
      }
    }
  }

  private collide(a: PhysicsBody, b: PhysicsBody): Collision | undefined {
    const collision = CollisionResolver.resolve(a, b);
    if (!collision) return undefined;
    for (const observer of this.collisionObservers) observer.onCollision(collision);
    return collision;
  }
}
