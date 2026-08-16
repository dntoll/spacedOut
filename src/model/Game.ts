import type { Vec2 } from '../types';
import { AsteroidBelt } from './AsteroidBelt';
import type { CollisionObserver } from './CollisionObserver';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import { Ship } from './Ship';
import { ShipCollisionSystem } from './ShipCollisionSystem';
import { SupplyField } from './SupplyField';
import type { PolygonObstacle } from './SweptCircleCollision';

export class Game {
  readonly ship = new Ship();
  readonly asteroidBelt = new AsteroidBelt(this.ship.position);
  readonly supplyField = new SupplyField(this.ship.position);
  readonly massiveAsteroidField = new MassiveAsteroidField(this.ship.position, this.ship.radius);
  private readonly shipCollisions = new ShipCollisionSystem();
  private spawnExclusionRadius = 1500;
  elapsed = 0;

  get speed(): number { return this.ship.speed; }
  get thrusting(): boolean { return this.ship.isThrusting; }
  get thrustAmount(): number { return this.ship.thrustAmount; }

  setThrustTarget(target: Vec2): void { this.ship.aimAt(target); }
  startThrust(): void { this.ship.startThrust(); }
  stopThrust(): void { this.ship.stopThrust(); }
  setSpawnExclusionRadius(radius: number): void { this.spawnExclusionRadius = Math.max(0, radius); }
  addCollisionObserver(observer: CollisionObserver): void {
    this.asteroidBelt.addCollisionObserver(observer);
    this.massiveAsteroidField.addCollisionObserver(observer);
    this.shipCollisions.addCollisionObserver(observer);
  }
  removeCollisionObserver(observer: CollisionObserver): void {
    this.asteroidBelt.removeCollisionObserver(observer);
    this.massiveAsteroidField.removeCollisionObserver(observer);
    this.shipCollisions.removeCollisionObserver(observer);
  }

  update(dt: number): void {
    dt = Math.min(dt, 0.033);
    this.elapsed += dt;
    this.ship.updateLifeSupport(dt);
    this.ship.applyControls(dt);

    this.ship.integrate(dt);
    const spawnBoundary = this.spawnExclusionRadius + this.ship.speed * 1.2;
    this.asteroidBelt.update(dt, this.ship.position, spawnBoundary);
    this.supplyField.update(dt, this.ship, this.asteroidBelt, spawnBoundary);
    this.massiveAsteroidField.prepareAround(this.ship.position, spawnBoundary);
    this.massiveAsteroidField.resolveBodyCollisions(this.asteroidBelt, this.supplyField);

    const obstacles: PolygonObstacle[] = [];
    this.asteroidBelt.forEach((asteroid) => obstacles.push(asteroid));
    this.massiveAsteroidField.forEachActive((asteroid) => obstacles.push(asteroid));
    this.shipCollisions.resolve(this.ship, obstacles, dt);
  }
}
