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
const ISLAND_MIN_ROCKS = 10;
const ISLAND_MAX_ROCKS = 100;
const ISLAND_BASE_SPREAD = 600;
const ISLAND_BASE_ROCKS = 12;
const ISLAND_ASPECT_MIN = 1.4;
const ISLAND_ASPECT_MAX = 2.6;
const ISLAND_OUTLINE_SEGMENTS = 22;
const ISLAND_GAP_BASE = 14000;
const ISLAND_GAP_JITTER = 10000;
const ISLAND_LEAD = 1800;
const ISLAND_RING_MARGIN = 120;
const ISLAND_LATERAL = 2000;
const ISLAND_PERIPHERAL_FRACTION = 0.5;
const ISLAND_RECYCLE_MARGIN = 600;
const ISLAND_DRONE_FRACTION = 0.3;
const ISLAND_DRONE_MIN = 1;
const ISLAND_DRONE_MAX = 8;
const ISLAND_MAX_RADIUS = ISLAND_BASE_SPREAD * Math.sqrt(ISLAND_MAX_ROCKS / ISLAND_BASE_ROCKS) * ISLAND_ASPECT_MAX + ISLAND_RING_MARGIN;

export interface AsteroidIsland {
  center: Vec2;
  radius: number;
  outline: Vec2[];
  droneCount: number;
}

export class AsteroidBelt {
  private readonly asteroids: Asteroid[] = [];
  private readonly collisionObservers = new Set<CollisionObserver>();
  private readonly asteroidCollisionObservers = new Set<AsteroidCollisionObserver>();
  private readonly destructionObservers = new Set<AsteroidDestroyedObserver>();
  private readonly islands: AsteroidIsland[] = [];
  private nextId = 0;
  private lastIslandProgress: number | null = null;
  private nextIslandGap = ISLAND_GAP_BASE;

  constructor(center: Vec2, initialAsteroids?: Asteroid[]) {
    if (initialAsteroids) {
      this.asteroids.push(...initialAsteroids);
      return;
    }
    for (let i = 0; i < 60; i++) {
      this.asteroids.push(this.createAsteroid(center, i < 14 ? 260 : 500, 1600));
    }
  }

  update(dt: number, center: Vec2, spawnExclusionRadius = 1450, spawnEnabled = true, islands = false, travelDirection: Vec2 | null = null): void {
    for (const asteroid of this.asteroids) {
      asteroid.integrate(dt);
    }
    this.resolveInternalCollisions();
    if (spawnEnabled) this.recycleDistantAsteroids(center, spawnExclusionRadius, islands, travelDirection);
  }

  forEach(visitor: (asteroid: Asteroid) => void): void {
    this.asteroids.forEach(visitor);
  }

  forEachIsland(visitor: (island: AsteroidIsland) => void): void {
    this.islands.forEach(visitor);
  }

  has(asteroid: Asteroid): boolean { return this.asteroids.includes(asteroid); }

  anyWithin(position: Vec2, radius: number): boolean {
    for (const asteroid of this.asteroids) {
      if (length(sub(asteroid.position, position)) <= radius + asteroid.radius) return true;
    }
    return false;
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

  private recycleDistantAsteroids(center: Vec2, spawnExclusionRadius: number, islands = false, travelDirection: Vec2 | null = null): void {
    const spawnInnerRadius = Math.max(1050, spawnExclusionRadius + 180);
    const ahead = spawnInnerRadius + ISLAND_LEAD;
    const recycleRadius = islands ? ahead + ISLAND_MAX_RADIUS + ISLAND_RECYCLE_MARGIN : spawnInnerRadius + 800;
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      if (length(sub(this.asteroids[i].position, center)) > recycleRadius) {
        if (islands) {
          this.asteroids.splice(i, 1);
        } else {
          this.asteroids[i] = this.createAsteroid(center, spawnInnerRadius, spawnInnerRadius + 500);
        }
      }
    }
    if (islands) {
      for (let i = this.islands.length - 1; i >= 0; i--) {
        if (length(sub(this.islands[i].center, center)) > recycleRadius) this.islands.splice(i, 1);
      }
    }
    if (islands && travelDirection) this.spawnIslands(center, travelDirection, ahead);
  }

  private spawnIslands(center: Vec2, travelDirection: Vec2, ahead: number): void {
    const progress = center.x * travelDirection.x + center.y * travelDirection.y;
    if (this.lastIslandProgress === null) this.lastIslandProgress = progress - this.nextIslandGap;
    const perp: Vec2 = { x: -travelDirection.y, y: travelDirection.x };
    while (progress >= this.lastIslandProgress + this.nextIslandGap) {
      this.lastIslandProgress += this.nextIslandGap;
      this.nextIslandGap = ISLAND_GAP_BASE + random(0, ISLAND_GAP_JITTER);
      const rockCount = Math.floor(random(ISLAND_MIN_ROCKS, ISLAND_MAX_ROCKS + 1));
      const spread = ISLAND_BASE_SPREAD * Math.sqrt(rockCount / ISLAND_BASE_ROCKS);
      const aspect = random(ISLAND_ASPECT_MIN, ISLAND_ASPECT_MAX);
      const rotation = random(0, Math.PI * 2);
      const a = spread * aspect;
      const b = spread / aspect;
      const routeCenter = add(center, scale(travelDirection, ahead));
      let islandCenter = routeCenter;
      if (random(0, 1) < ISLAND_PERIPHERAL_FRACTION) {
        const lateral = random(0.4, 1) * (ISLAND_LATERAL + spread) * (random(0, 1) < 0.5 ? 1 : -1);
        islandCenter = add(routeCenter, scale(perp, lateral));
      }
      const outline = this.buildOutline(islandCenter, a, b, rotation);
      const droneCount = Math.random() < ISLAND_DRONE_FRACTION
        ? Math.floor(random(ISLAND_DRONE_MIN, ISLAND_DRONE_MAX + 1))
        : 0;
      this.islands.push({ center: { ...islandCenter }, radius: Math.max(a, b) + ISLAND_RING_MARGIN, outline, droneCount });
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      for (let i = 0; i < rockCount; i++) {
        const angle = random(0, Math.PI * 2);
        const t = Math.sqrt(random(0, 1));
        const local: Vec2 = { x: a * t * Math.cos(angle), y: b * t * Math.sin(angle) };
        const position = add(islandCenter, {
          x: local.x * cos - local.y * sin,
          y: local.x * sin + local.y * cos,
        });
        const radius = AsteroidBelt.pickRadius();
        const vertexCount = Math.floor(random(8, 13));
        this.asteroids.push(new Asteroid(
          this.nextId++,
          position,
          { x: random(-16, 16), y: random(-16, 16) },
          radius,
          random(0, Math.PI * 2),
          random(-0.22, 0.22),
          Array.from({ length: vertexCount }, () => random(0.78, 1.12)),
          random(0, 1),
        ));
      }
    }
  }

  private buildOutline(center: Vec2, a: number, b: number, rotation: number): Vec2[] {
    const points: Vec2[] = [];
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const ra = a + ISLAND_RING_MARGIN;
    const rb = b + ISLAND_RING_MARGIN;
    for (let i = 0; i < ISLAND_OUTLINE_SEGMENTS; i++) {
      const angle = (i / ISLAND_OUTLINE_SEGMENTS) * Math.PI * 2;
      const jitter = random(0.82, 1.16);
      const local: Vec2 = { x: ra * jitter * Math.cos(angle), y: rb * jitter * Math.sin(angle) };
      points.push({
        x: center.x + local.x * cos - local.y * sin,
        y: center.y + local.x * sin + local.y * cos,
      });
    }
    return points;
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
