import { add, clamp, dot, length, normalize, random, scale, sub } from '../math';
import type { Vec2 } from '../types';
import { Asteroid } from './Asteroid';
import { Collision } from './Collision';
import type { CollisionObserver } from './CollisionObserver';
import type { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';

export class AsteroidBelt {
  private readonly asteroids: Asteroid[] = [];
  private readonly collisionObservers = new Set<CollisionObserver>();
  private nextId = 0;

  constructor(center: Vec2) {
    for (let i = 0; i < 34; i++) {
      this.asteroids.push(this.createAsteroid(center, i < 8 ? 260 : 500, 1600));
    }
  }

  update(dt: number, ship: Ship): void {
    for (const asteroid of this.asteroids) {
      asteroid.integrate(dt);
      this.collide(ship, asteroid);
    }
    this.resolveInternalCollisions();
    this.recycleDistantAsteroids(ship.position);
  }

  forEach(visitor: (asteroid: Asteroid) => void): void {
    this.asteroids.forEach(visitor);
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
    const delta = sub(b.position, a.position);
    const distance = length(delta);
    const overlap = a.radius + b.radius - distance;
    if (overlap <= 0) return;

    const normal = distance > 0 ? scale(delta, 1 / distance) : { x: 1, y: 0 };
    const invA = 1 / a.mass;
    const invB = 1 / b.mass;
    const correction = scale(normal, overlap / (invA + invB) * 0.82);
    a.position = sub(a.position, scale(correction, invA));
    b.position = add(b.position, scale(correction, invB));

    const relative = sub(b.velocity, a.velocity);
    const closing = dot(relative, normal);
    if (closing >= 0) return;

    const impulseSize = -(1 + 0.72) * closing / (invA + invB);
    const impulse = scale(normal, impulseSize);
    a.velocity = sub(a.velocity, scale(impulse, invA));
    b.velocity = add(b.velocity, scale(impulse, invB));

    const tangent = normalize(sub(relative, scale(normal, closing)));
    const scrape = dot(relative, tangent);
    b.angularVelocity = clamp(b.angularVelocity - scrape / Math.max(25, b.radius) * 0.35, -2.5, 2.5);
    a.angularVelocity = clamp(a.angularVelocity + scrape * 0.002, -0.8, 0.8);

    const collision = new Collision(add(a.position, scale(normal, a.radius)), normal, -closing);
    for (const observer of this.collisionObservers) observer.onCollision(collision);
  }
}
