import { add, length, normalize, scale, sub } from '../math';
import type { Vec2 } from '../types';
import type { Asteroid } from './Asteroid';
import type { AsteroidBelt } from './AsteroidBelt';
import { Collision } from './Collision';
import type { CollisionObserver } from './CollisionObserver';
import type { Drone } from './Drone';
import type { DroneField } from './DroneField';
import type { LaserImpactObserver } from './LaserImpactObserver';
import { Laser } from './Laser';
import { LaserShot } from './LaserShot';
import type { LaserShotObserver } from './LaserShotObserver';
import type { MassiveAsteroid } from './MassiveAsteroid';
import type { MassiveAsteroidField } from './MassiveAsteroidField';
import type { Ship } from './Ship';

const NOSE_OFFSET = 22;
const LASER_SPEED = 1800;
const LASER_RADIUS = 2.5;
const FIRE_COOLDOWN = 0.18;
const SHOT_COST = 1;
const CULL_MARGIN = 60;

export class LaserField {
  private readonly lasers: Laser[] = [];
  private readonly collisionObservers = new Set<CollisionObserver>();
  private readonly laserShotObservers = new Set<LaserShotObserver>();
  private readonly laserImpactObservers = new Set<LaserImpactObserver>();
  private cooldown = 0;

  forEach(visitor: (laser: Laser) => void): void { this.lasers.forEach(visitor); }
  get count(): number { return this.lasers.length; }

  addCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.add(observer); }
  removeCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.delete(observer); }
  addLaserShotObserver(observer: LaserShotObserver): void { this.laserShotObservers.add(observer); }
  removeLaserShotObserver(observer: LaserShotObserver): void { this.laserShotObservers.delete(observer); }
  addLaserImpactObserver(observer: LaserImpactObserver): void { this.laserImpactObservers.add(observer); }
  removeLaserImpactObserver(observer: LaserImpactObserver): void { this.laserImpactObservers.delete(observer); }

  fire(ship: Ship): void {
    if (this.cooldown > 0) return;
    if (!ship.consumeAmmo(SHOT_COST)) return;
    this.cooldown = FIRE_COOLDOWN;
    const forward = { x: Math.cos(ship.angle), y: Math.sin(ship.angle) };
    const muzzle = add(ship.position, scale(forward, NOSE_OFFSET));
    const velocity = add(scale(forward, LASER_SPEED), ship.velocity);
    this.lasers.push(new Laser(muzzle, velocity, ship.angle, LASER_RADIUS));
    const event = new LaserShot({ ...muzzle });
    for (const observer of this.laserShotObservers) observer.onLaserShot(event);
  }

  update(
    dt: number,
    ship: Ship,
    asteroidBelt: AsteroidBelt,
    massiveAsteroidField: MassiveAsteroidField,
    cullRadius = Number.POSITIVE_INFINITY,
    droneField?: DroneField,
  ): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const maxRange = cullRadius + CULL_MARGIN;
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.update(dt);
      if (length(sub(laser.position, ship.position)) > maxRange) { this.lasers.splice(i, 1); continue; }

      const regularHit = this.nearestRegularHit(laser, asteroidBelt);
      if (regularHit) {
        this.emitSpark(laser.position, normalize(sub(laser.position, regularHit.asteroid.position)));
        asteroidBelt.applyLaserHit(regularHit.asteroid, laser.position);
        this.lasers.splice(i, 1);
        continue;
      }

      const massive = this.massiveHit(laser, massiveAsteroidField);
      if (massive) {
        this.emitSpark(laser.position, normalize(sub(laser.position, massive.position)));
        this.lasers.splice(i, 1);
        continue;
      }

      if (droneField) {
        const drone = this.droneHit(laser, droneField);
        if (drone) {
          this.emitSpark(laser.position, normalize(sub(laser.position, drone.position)));
          droneField.applyLaserHit(drone, laser.position);
          this.lasers.splice(i, 1);
          continue;
        }
      }
    }
  }

  private droneHit(laser: Laser, droneField: DroneField): Drone | null {
    let hit: Drone | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    droneField.forEach((drone) => {
      const distance = length(sub(drone.position, laser.position));
      if (distance <= drone.radius + laser.radius && distance < bestDistance) {
        bestDistance = distance;
        hit = drone;
      }
    });
    return hit;
  }

  private nearestRegularHit(laser: Laser, asteroidBelt: AsteroidBelt): { asteroid: Asteroid } | null {
    const candidates: Asteroid[] = [];
    asteroidBelt.forEach((asteroid) => {
      if (length(sub(asteroid.position, laser.position)) <= asteroid.radius + laser.radius) candidates.push(asteroid);
    });
    if (candidates.length === 0) return null;
    let nearest = candidates[0];
    let nearestDistance = length(sub(nearest.position, laser.position));
    for (let i = 1; i < candidates.length; i++) {
      const distance = length(sub(candidates[i].position, laser.position));
      if (distance < nearestDistance) {
        nearest = candidates[i];
        nearestDistance = distance;
      }
    }
    return { asteroid: nearest };
  }

  private massiveHit(laser: Laser, massiveAsteroidField: MassiveAsteroidField): MassiveAsteroid | null {
    let hit: MassiveAsteroid | null = null;
    massiveAsteroidField.forEachActive((asteroid) => {
      if (hit) return;
      const boundary = massiveAsteroidField.boundaryRadiusAt(asteroid, laser.position);
      if (length(sub(asteroid.position, laser.position)) <= boundary + laser.radius) hit = asteroid;
    });
    return hit;
  }

  private emitSpark(position: Vec2, normal: Vec2): void {
    const collision = new Collision({ ...position }, normal, LASER_SPEED);
    for (const observer of this.collisionObservers) observer.onCollision(collision);
    for (const observer of this.laserImpactObservers) observer.onLaserImpact(collision);
  }
}
