import { add, random } from '../math';
import type { Vec2 } from '../types';
import type { AsteroidBelt } from './AsteroidBelt';
import type { CollisionObserver } from './CollisionObserver';
import { CollisionResolver } from './CollisionResolver';
import { MassiveAsteroid, type AsteroidCavity } from './MassiveAsteroid';
import type { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';
import type { SupplyField } from './SupplyField';

export class MassiveAsteroidField {
  private readonly asteroids: MassiveAsteroid[] = [];
  private readonly collisionObservers = new Set<CollisionObserver>();

  constructor(center: Vec2, shipRadius: number, initialAsteroids?: MassiveAsteroid[]) {
    if (initialAsteroids) {
      this.asteroids.push(...initialAsteroids);
      return;
    }
    for (let i = 0; i < 4; i++) this.asteroids.push(this.createAsteroid(i, center, shipRadius));
  }

  resolveBodyCollisions(asteroidBelt: AsteroidBelt, supplyField: SupplyField): void {
    for (const massive of this.asteroids) {
      asteroidBelt.forEach((asteroid) => this.collide(asteroid, massive));
      supplyField.forEach((container) => this.collide(container, massive));
    }
  }

  forEach(visitor: (asteroid: MassiveAsteroid) => void): void { this.asteroids.forEach(visitor); }
  addCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.add(observer); }
  removeCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.delete(observer); }

  private collide(body: PhysicsBody, massive: MassiveAsteroid): void {
    const boundaryRadius = this.boundaryRadiusAt(massive, body.position);
    const collision = CollisionResolver.resolveAgainstStaticBoundary(body, massive.position, boundaryRadius);
    if (!collision) return;
    for (const observer of this.collisionObservers) observer.onCollision(collision);
  }

  private boundaryRadiusAt(asteroid: MassiveAsteroid, worldPosition: Vec2): number {
    const worldAngle = Math.atan2(
      worldPosition.y - asteroid.position.y,
      worldPosition.x - asteroid.position.x,
    );
    const localAngle = ((worldAngle - asteroid.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const vertexPosition = localAngle / (Math.PI * 2) * asteroid.vertices.length;
    const firstIndex = Math.floor(vertexPosition) % asteroid.vertices.length;
    const secondIndex = (firstIndex + 1) % asteroid.vertices.length;
    const blend = vertexPosition - Math.floor(vertexPosition);
    const variation = asteroid.vertices[firstIndex] * (1 - blend) + asteroid.vertices[secondIndex] * blend;
    return asteroid.radius * variation;
  }

  private createAsteroid(id: number, center: Vec2, shipRadius: number): MassiveAsteroid {
    const radius = shipRadius * random(30, 100);
    const direction = random(0, Math.PI * 2);
    const distance = radius + random(320, 1200);
    const vertexCount = Math.floor(random(24, 40));
    const vertices = Array.from({ length: vertexCount }, () => random(0.72, 1.16));
    const cavityCount = Math.floor(random(4, 9));

    for (let i = 0; i < cavityCount; i++) {
      const index = Math.floor(random(0, vertexCount));
      vertices[index] = random(0.24, 0.5);
      vertices[(index + 1) % vertexCount] = random(0.42, 0.7);
      vertices[(index + vertexCount - 1) % vertexCount] = random(0.42, 0.7);
    }

    const cavities: AsteroidCavity[] = Array.from({ length: cavityCount }, () => {
      const angle = random(0, Math.PI * 2);
      const offset = random(0.15, 0.62) * radius;
      return {
        position: { x: Math.cos(angle) * offset, y: Math.sin(angle) * offset },
        radius: random(0.05, 0.17) * radius,
      };
    });

    return new MassiveAsteroid(
      id,
      add(center, { x: Math.cos(direction) * distance, y: Math.sin(direction) * distance }),
      radius,
      random(0, Math.PI * 2),
      vertices,
      cavities,
      random(0, 1),
    );
  }
}
