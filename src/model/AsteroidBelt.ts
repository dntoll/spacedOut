import { add, length, random, sub } from '../math';
import type { Vec2 } from '../types';
import { Asteroid } from './Asteroid';
import type { CollisionObserver } from './CollisionObserver';
import { CollisionResolver } from './CollisionResolver';
import type { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';

export class AsteroidBelt {
  private readonly asteroids: Asteroid[] = [];
  private readonly collisionObservers = new Set<CollisionObserver>();
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

  update(dt: number, center: Vec2): void {
    for (const asteroid of this.asteroids) {
      asteroid.integrate(dt);
    }
    this.resolveInternalCollisions();
    this.recycleDistantAsteroids(center);
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

  private createAsteroid(center: Vec2, minDistance: number, maxDistance: number): Asteroid {
    const direction = random(0, Math.PI * 2);
    const distance = random(minDistance, maxDistance);
    const radius = random(20, 62);
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

  private recycleDistantAsteroids(center: Vec2): void {
    for (let i = 0; i < this.asteroids.length; i++) {
      if (length(sub(this.asteroids[i].position, center)) > 1900) {
        this.asteroids[i] = this.createAsteroid(center, 1050, 1450);
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
        ) this.collide(a, b);
      }
    }
  }

  private collide(a: PhysicsBody, b: PhysicsBody): void {
    const collision = CollisionResolver.resolve(a, b);
    if (!collision) return;
    for (const observer of this.collisionObservers) observer.onCollision(collision);
  }
}
