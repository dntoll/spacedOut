import type { Vec2 } from '../types';
import type { AsteroidBelt } from './AsteroidBelt';
import type { CollisionObserver } from './CollisionObserver';
import { CollisionResolver } from './CollisionResolver';
import type { MassiveAsteroid } from './MassiveAsteroid';
import { MassiveAsteroidRegion } from './MassiveAsteroidRegion';
import type { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';
import type { SupplyField } from './SupplyField';

export class MassiveAsteroidField {
  static readonly regionSize = 6000;
  private readonly regions = new Map<number, Map<number, MassiveAsteroidRegion>>();
  private activeAsteroids: MassiveAsteroid[] = [];
  private readonly fixedAsteroids?: MassiveAsteroid[];
  private readonly collisionObservers = new Set<CollisionObserver>();

  constructor(
    center: Vec2,
    private readonly shipRadius: number,
    initialAsteroids?: MassiveAsteroid[],
    private readonly worldSeed = Math.floor(Math.random() * 0x1_0000_0000),
  ) {
    if (initialAsteroids) {
      this.fixedAsteroids = [...initialAsteroids];
      this.activeAsteroids = [...initialAsteroids];
      return;
    }
    this.prepareAround(center, 6500);
    this.prepareAround(center, 1500);
  }

  prepareAround(center: Vec2, spawnExclusionRadius: number): void {
    if (this.fixedAsteroids) return;
    const centerColumn = Math.floor(center.x / MassiveAsteroidField.regionSize);
    const centerRow = Math.floor(center.y / MassiveAsteroidField.regionSize);
    const regionRadius = Math.max(1, Math.ceil(
      (spawnExclusionRadius + this.shipRadius * 100) / MassiveAsteroidField.regionSize,
    ));
    const active: MassiveAsteroid[] = [];
    for (let column = centerColumn - regionRadius; column <= centerColumn + regionRadius; column++) {
      for (let row = centerRow - regionRadius; row <= centerRow + regionRadius; row++) {
        active.push(this.getOrCreateRegion(column, row).asteroid);
      }
    }
    this.activeAsteroids = active;
  }

  resolveBodyCollisions(asteroidBelt: AsteroidBelt, supplyField: SupplyField): void {
    for (const massive of this.activeAsteroids) {
      asteroidBelt.forEach((asteroid) => this.collide(asteroid, massive));
      supplyField.forEachActive((container) => this.collide(container, massive));
    }
  }

  forEachActive(visitor: (asteroid: MassiveAsteroid) => void): void { this.activeAsteroids.forEach(visitor); }
  forEachKnown(visitor: (asteroid: MassiveAsteroid) => void): void {
    if (this.fixedAsteroids) {
      this.fixedAsteroids.forEach(visitor);
      return;
    }
    for (const rows of this.regions.values()) {
      for (const region of rows.values()) visitor(region.asteroid);
    }
  }
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

  private getOrCreateRegion(column: number, row: number): MassiveAsteroidRegion {
    const existing = this.regions.get(column)?.get(row);
    if (existing) return existing;
    const region = new MassiveAsteroidRegion(
      column,
      row,
      MassiveAsteroidField.regionSize,
      this.shipRadius,
      this.worldSeed,
    );
    let rows = this.regions.get(column);
    if (!rows) {
      rows = new Map<number, MassiveAsteroidRegion>();
      this.regions.set(column, rows);
    }
    rows.set(row, region);
    return region;
  }
}
