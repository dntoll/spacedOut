import { length, random, sub } from '../math';
import type { Vec2 } from '../types';
import type { AsteroidBelt } from './AsteroidBelt';
import type { AsteroidCollisionObserver } from './AsteroidCollisionObserver';
import { AsteroidCavityField } from './AsteroidCavityField';
import { Collision } from './Collision';
import type { CollisionObserver } from './CollisionObserver';
import { CollisionResolver } from './CollisionResolver';
import { MassiveAsteroid } from './MassiveAsteroid';
import { MassiveAsteroidRegion } from './MassiveAsteroidRegion';
import type { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';
import type { SupplyField } from './SupplyField';

const DESTINATION_VERTEX_COUNT = 36;
const DESTINATION_CAVITY_COUNT = 12;

export class MassiveAsteroidField {
  static readonly regionSize = 6000;
  private readonly regions = new Map<number, Map<number, MassiveAsteroidRegion>>();
  private activeAsteroids: MassiveAsteroid[] = [];
  private readonly fixedAsteroids?: MassiveAsteroid[];
  private destinationAsteroid: MassiveAsteroid | null = null;
  private readonly collisionObservers = new Set<CollisionObserver>();
  private readonly asteroidCollisionObservers = new Set<AsteroidCollisionObserver>();

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

  prepareAround(center: Vec2, spawnExclusionRadius: number, spawnEnabled = true): void {
    if (this.fixedAsteroids) return;
    if (!spawnEnabled) {
      if (this.destinationAsteroid) this.activeAsteroids = [this.destinationAsteroid];
      return;
    }
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
    if (this.destinationAsteroid) active.push(this.destinationAsteroid);
    this.activeAsteroids = active;
  }

  placeDestination(position: Vec2, radius: number): void {
    const vertices = Array.from({ length: DESTINATION_VERTEX_COUNT }, () => random(0.74, 1.14));
    for (let i = 0; i < DESTINATION_CAVITY_COUNT; i++) {
      const vertex = Math.floor(random(0, DESTINATION_VERTEX_COUNT));
      vertices[vertex] = random(0.26, 0.5);
      vertices[(vertex + 1) % DESTINATION_VERTEX_COUNT] = random(0.44, 0.7);
      vertices[(vertex + DESTINATION_VERTEX_COUNT - 1) % DESTINATION_VERTEX_COUNT] = random(0.44, 0.7);
    }
    const asteroid = new MassiveAsteroid(
      0x7fffffff,
      { ...position },
      radius,
      random(0, Math.PI * 2),
      vertices,
      new AsteroidCavityField().create(radius, vertices, DESTINATION_CAVITY_COUNT),
      random(0, 1),
    );
    this.destinationAsteroid = asteroid;
    if (this.fixedAsteroids) {
      if (!this.activeAsteroids.includes(asteroid)) this.activeAsteroids.push(asteroid);
      return;
    }
    this.regions.clear();
    this.activeAsteroids = [asteroid];
  }

  suppressAmbient(): void {
    if (this.fixedAsteroids) return;
    this.regions.clear();
    this.activeAsteroids = [];
  }

  get destination(): MassiveAsteroid | null { return this.destinationAsteroid; }

  resolveBodyCollisions(asteroidBelt: AsteroidBelt, supplyField: SupplyField): void {
    for (const massive of this.activeAsteroids) {
      asteroidBelt.forEach((asteroid) => {
        const collision = this.collide(asteroid, massive);
        if (collision) {
          for (const observer of this.asteroidCollisionObservers) observer.onAsteroidCollision(collision);
        }
      });
      supplyField.forEachActive((container) => this.collide(container, massive));
    }
  }

  forEachActive(visitor: (asteroid: MassiveAsteroid) => void): void { this.activeAsteroids.forEach(visitor); }

  has(asteroid: MassiveAsteroid): boolean { return this.activeAsteroids.includes(asteroid); }

  anyWithin(position: Vec2, radius: number): boolean {
    for (const asteroid of this.activeAsteroids) {
      if (length(sub(asteroid.position, position)) <= radius + asteroid.radius) return true;
    }
    return false;
  }
  forEachKnown(visitor: (asteroid: MassiveAsteroid) => void): void {
    if (this.fixedAsteroids) {
      this.fixedAsteroids.forEach(visitor);
      if (this.destinationAsteroid) visitor(this.destinationAsteroid);
      return;
    }
    for (const rows of this.regions.values()) {
      for (const region of rows.values()) visitor(region.asteroid);
    }
    if (this.destinationAsteroid) visitor(this.destinationAsteroid);
  }
  addCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.add(observer); }
  removeCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.delete(observer); }
  addAsteroidCollisionObserver(observer: AsteroidCollisionObserver): void { this.asteroidCollisionObservers.add(observer); }
  removeAsteroidCollisionObserver(observer: AsteroidCollisionObserver): void { this.asteroidCollisionObservers.delete(observer); }

  private collide(body: PhysicsBody, massive: MassiveAsteroid): Collision | undefined {
    const boundaryRadius = this.boundaryRadiusAt(massive, body.position);
    const collision = CollisionResolver.resolveAgainstStaticBoundary(body, massive.position, boundaryRadius);
    if (!collision) return undefined;
    for (const observer of this.collisionObservers) observer.onCollision(collision);
    return collision;
  }

  boundaryRadiusAt(asteroid: MassiveAsteroid, worldPosition: Vec2): number {
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
