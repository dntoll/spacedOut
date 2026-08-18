import type { ControlTuning, Vec2 } from '../types';
import { AmmoContainer } from './AmmoContainer';
import { AsteroidBelt } from './AsteroidBelt';
import { AsteroidDestroyed } from './AsteroidDestroyed';
import type { AsteroidDestroyedObserver } from './AsteroidDestroyedObserver';
import type { AsteroidCollisionObserver } from './AsteroidCollisionObserver';
import type { CollectablePickupObserver } from './CollectablePickupObserver';
import type { CollisionObserver } from './CollisionObserver';
import type { DamageObserver } from './DamageObserver';
import { DroneField } from './DroneField';
import type { DroneDestroyedObserver } from './DroneDestroyedObserver';
import { FuelContainer } from './FuelContainer';
import { HpContainer } from './HpContainer';
import type { LaserImpactObserver } from './LaserImpactObserver';
import { LaserField } from './LaserField';
import type { LaserShotObserver } from './LaserShotObserver';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import { Mission } from './Mission';
import { Ship } from './Ship';
import { ShipCollisionSystem } from './ShipCollisionSystem';
import { SupplyChooser, SupplyType } from './SupplyChooser';
import { SupplyContainer } from './SupplyContainer';
import { SupplyField } from './SupplyField';
import type { PolygonObstacle } from './SweptCircleCollision';
import { VisitedMap } from './VisitedMap';

const DROP_PROBABILITY = 0.35;
const DROP_AMOUNT = 24;

export class Game implements AsteroidDestroyedObserver {
  readonly ship = new Ship({ fuel: 50, hp: 50, ammo: 50 });
  readonly asteroidBelt = new AsteroidBelt(this.ship.position);
  readonly supplyField = new SupplyField(this.ship.position);
  readonly massiveAsteroidField = new MassiveAsteroidField(this.ship.position, this.ship.radius);
  readonly laserField = new LaserField();
  readonly droneField = new DroneField();
  readonly mission = new Mission();
  readonly visitedMap = new VisitedMap();
  private readonly shipCollisions = new ShipCollisionSystem();
  private spawnExclusionRadius = 1500;
  elapsed = 0;

  constructor() {
    this.asteroidBelt.addAsteroidDestroyedObserver(this);
  }

  get speed(): number { return this.ship.speed; }
  get thrusting(): boolean { return this.ship.isThrusting; }
  get thrustAmount(): number { return this.ship.thrustAmount; }
  get turnRate(): number { return this.ship.turnRate; }
  get speedFraction(): number { return this.ship.speedFraction; }
  get isGameOver(): boolean { return !this.ship.isAlive; }

  setThrustTarget(target: Vec2): void { this.ship.aimAt(target); }
  setControlTuning(tuning: ControlTuning): void { this.ship.setControlTuning(tuning); }
  setDirectionalThrust(vec: Vec2 | null): void { this.ship.setDirectionalThrust(vec); }
  startThrust(): void { this.ship.startThrust(); }
  stopThrust(): void { this.ship.stopThrust(); }
  fireLaser(): void {
    this.laserField.fire(this.ship);
    this.droneField.awakenNearby(this.ship, this.spawnExclusionRadius);
  }
  setSpawnExclusionRadius(radius: number): void { this.spawnExclusionRadius = Math.max(0, radius); }

  advanceMission(): void { this.mission.advance(this.visitedMap); }
  addCollisionObserver(observer: CollisionObserver): void {
    this.asteroidBelt.addCollisionObserver(observer);
    this.massiveAsteroidField.addCollisionObserver(observer);
    this.shipCollisions.addCollisionObserver(observer);
    this.laserField.addCollisionObserver(observer);
  }
  removeCollisionObserver(observer: CollisionObserver): void {
    this.asteroidBelt.removeCollisionObserver(observer);
    this.massiveAsteroidField.removeCollisionObserver(observer);
    this.shipCollisions.removeCollisionObserver(observer);
    this.laserField.removeCollisionObserver(observer);
  }
  addDamageObserver(observer: DamageObserver): void {
    this.shipCollisions.addDamageObserver(observer);
    this.droneField.addDamageObserver(observer);
  }
  removeDamageObserver(observer: DamageObserver): void {
    this.shipCollisions.removeDamageObserver(observer);
    this.droneField.removeDamageObserver(observer);
  }
  addDroneDestroyedObserver(observer: DroneDestroyedObserver): void { this.droneField.addDroneDestroyedObserver(observer); }
  removeDroneDestroyedObserver(observer: DroneDestroyedObserver): void { this.droneField.removeDroneDestroyedObserver(observer); }
  addAsteroidDestroyedObserver(observer: AsteroidDestroyedObserver): void {
    this.asteroidBelt.addAsteroidDestroyedObserver(observer);
  }
  removeAsteroidDestroyedObserver(observer: AsteroidDestroyedObserver): void {
    this.asteroidBelt.removeAsteroidDestroyedObserver(observer);
  }
  addLaserShotObserver(observer: LaserShotObserver): void { this.laserField.addLaserShotObserver(observer); }
  removeLaserShotObserver(observer: LaserShotObserver): void { this.laserField.removeLaserShotObserver(observer); }
  addLaserImpactObserver(observer: LaserImpactObserver): void { this.laserField.addLaserImpactObserver(observer); }
  removeLaserImpactObserver(observer: LaserImpactObserver): void { this.laserField.removeLaserImpactObserver(observer); }
  addAsteroidCollisionObserver(observer: AsteroidCollisionObserver): void {
    this.asteroidBelt.addAsteroidCollisionObserver(observer);
    this.massiveAsteroidField.addAsteroidCollisionObserver(observer);
  }
  removeAsteroidCollisionObserver(observer: AsteroidCollisionObserver): void {
    this.asteroidBelt.removeAsteroidCollisionObserver(observer);
    this.massiveAsteroidField.removeAsteroidCollisionObserver(observer);
  }
  addCollectablePickupObserver(observer: CollectablePickupObserver): void { this.supplyField.addCollectablePickupObserver(observer); }
  removeCollectablePickupObserver(observer: CollectablePickupObserver): void { this.supplyField.removeCollectablePickupObserver(observer); }

  onDestroyed(event: AsteroidDestroyed): void {
    if (Math.random() >= DROP_PROBABILITY) return;
    this.supplyField.drop(this.createDrop(event.position));
  }

  private createDrop(position: Vec2): SupplyContainer {
    const visible = this.supplyField.visibleTypes(this.ship, this.spawnExclusionRadius);
    const type = SupplyChooser.choose({ fuel: this.ship.fuel, hp: this.ship.hp, ammo: this.ship.ammo }, visible, Math.random);
    return this.createSupply(type, position);
  }

  private createSupply(type: SupplyType, position: Vec2): SupplyContainer {
    if (type === SupplyType.Fuel) return new FuelContainer({ ...position }, DROP_AMOUNT);
    if (type === SupplyType.Hp) return new HpContainer({ ...position }, DROP_AMOUNT);
    return new AmmoContainer({ ...position }, DROP_AMOUNT);
  }

  update(dt: number): void {
    dt = Math.min(dt, 0.033);
    this.elapsed += dt;
    if (!this.ship.isAlive) return;
    if (this.mission.isPaused) return;
    this.ship.updateInvulnerability(dt);
    this.ship.updateEmergencyReload(dt);
    this.ship.applyControls(dt);

    this.ship.integrate(dt);
    this.visitedMap.visit(this.ship.position);
    const spawnBoundary = this.spawnExclusionRadius + this.ship.speed * 1.2;
    const spawnEnabled = !this.mission.suppressSpawning;
    this.asteroidBelt.update(dt, this.ship.position, spawnBoundary, spawnEnabled);
    this.supplyField.update(dt, this.ship, this.asteroidBelt, spawnBoundary, this.spawnExclusionRadius, spawnEnabled);
    this.massiveAsteroidField.prepareAround(this.ship.position, spawnBoundary, spawnEnabled);
    this.massiveAsteroidField.resolveBodyCollisions(this.asteroidBelt, this.supplyField);
    this.droneField.update(dt, this.ship, this.asteroidBelt, this.massiveAsteroidField, spawnBoundary, spawnEnabled);
    this.laserField.update(dt, this.ship, this.asteroidBelt, this.massiveAsteroidField, this.spawnExclusionRadius, this.droneField);

    const obstacles: PolygonObstacle[] = [];
    this.asteroidBelt.forEach((asteroid) => obstacles.push(asteroid));
    this.massiveAsteroidField.forEachActive((asteroid) => obstacles.push(asteroid));
    this.shipCollisions.resolve(this.ship, obstacles, dt);

    this.mission.update(dt, this.ship, this.droneField, this.asteroidBelt, this.massiveAsteroidField, this.visitedMap, this.spawnExclusionRadius);
  }
}
