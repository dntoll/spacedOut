import type { ControlTuning, Bounds, Vec2 } from '../types';
import { AmmoContainer } from './AmmoContainer';
import { AsteroidBelt } from './AsteroidBelt';
import { AsteroidDestroyed } from './AsteroidDestroyed';
import type { AsteroidDestroyedObserver } from './AsteroidDestroyedObserver';
import type { AsteroidCollisionObserver } from './AsteroidCollisionObserver';
import type { CollectablePickupObserver } from './CollectablePickupObserver';
import type { CollisionObserver } from './CollisionObserver';
import { DamageCalculator } from './DamageCalculator';
import type { DamageObserver } from './DamageObserver';
import { DiscoveredMap } from './DiscoveredMap';
import { DroneField } from './DroneField';
import type { DroneDestroyedObserver } from './DroneDestroyedObserver';
import { DroneDestroyed } from './DroneDestroyed';
import { FuelContainer } from './FuelContainer';
import { HpContainer } from './HpContainer';
import type { LaserImpactObserver } from './LaserImpactObserver';
import { LaserField } from './LaserField';
import type { LaserShotObserver } from './LaserShotObserver';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import { Mission, MissionPhase, SpawnMode } from './Mission';
import { PirateField } from './PirateField';
import { PirateDestroyed } from './PirateDestroyed';
import type { PirateDestroyedObserver } from './PirateDestroyedObserver';
import { Ship } from './Ship';
import { ShipCollisionSystem } from './ShipCollisionSystem';
import { StationMaze } from './StationMaze';
import { SupplyChooser, SupplyType } from './SupplyChooser';
import { SupplyContainer } from './SupplyContainer';
import { SupplyField } from './SupplyField';
import type { PhysicsBody } from './PhysicsBody';
import type { ShipObstacle } from './SweptCircleCollision';
import { VisitedMap } from './VisitedMap';
import { WeaponPod } from './WeaponPod';

const DROP_PROBABILITY = 0.35;
const DROP_AMOUNT = 24;
const PIRATE_WEAPON_DROP_PROBABILITY = 0.2;

export interface GameOptions {
  startingMission?: 1 | 2 | 3;
}

export class Game implements AsteroidDestroyedObserver, PirateDestroyedObserver, DroneDestroyedObserver {
  readonly ship = new Ship({ fuel: 50, hp: 50, ammo: 50 });
  readonly asteroidBelt = new AsteroidBelt(this.ship.position);
  readonly supplyField = new SupplyField(this.ship.position);
  readonly massiveAsteroidField = new MassiveAsteroidField(this.ship.position, this.ship.radius);
  readonly laserField = new LaserField();
  readonly droneField = new DroneField();
  readonly pirateField = new PirateField();
  readonly stationMaze = new StationMaze();
  readonly mission = new Mission();
  readonly visitedMap = new VisitedMap();
  readonly discoveredMap = new DiscoveredMap();
  private readonly shipCollisions = new ShipCollisionSystem();
  private spawnExclusionRadius = 1500;
  elapsed = 0;

  constructor(options?: GameOptions) {
    this.asteroidBelt.addAsteroidDestroyedObserver(this);
    this.pirateField.addPirateDestroyedObserver(this);
    this.droneField.addDroneDestroyedObserver(this);
    if (options?.startingMission === 2) {
      this.ship.collectFuel(100);
      this.ship.repair(100);
      this.ship.collectAmmo(100);
      this.mission.jumpToMission2Briefing();
      this.massiveAsteroidField.suppressAmbient();
    } else if (options?.startingMission === 3) {
      this.ship.collectFuel(100);
      this.ship.repair(100);
      this.ship.collectAmmo(100);
      this.ship.upgradeWeapon();
      this.ship.upgradeWeapon();
      this.mission.jumpToMission3Briefing(this.ship, this.stationMaze);
      this.clearMissionEncounters();
    }
  }

  get speed(): number { return this.ship.speed; }
  get thrusting(): boolean { return this.ship.isThrusting; }
  get thrustAmount(): number { return this.ship.thrustAmount; }
  get turnRate(): number { return this.ship.turnRate; }
  get speedFraction(): number { return this.ship.speedFraction; }
  get isGameOver(): boolean { return !this.ship.isAlive; }
  get damageSpeedThreshold(): number { return DamageCalculator.violentThreshold; }

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
  recordDiscoveredBounds(bounds: Bounds): void { this.discoveredMap.record(bounds); }

  advanceMission(): void {
    const previous = this.mission.phase;
    this.mission.advance(this.visitedMap);
    if (previous === MissionPhase.Mission2Done && this.mission.phase === MissionPhase.Mission3Intro) {
      this.clearMissionEncounters();
    }
  }
  addCollisionObserver(observer: CollisionObserver): void {
    this.asteroidBelt.addCollisionObserver(observer);
    this.massiveAsteroidField.addCollisionObserver(observer);
    this.shipCollisions.addCollisionObserver(observer);
    this.laserField.addCollisionObserver(observer);
    this.pirateField.addCollisionObserver(observer);
    this.droneField.addCollisionObserver(observer);
    this.stationMaze.addCollisionObserver(observer);
  }
  removeCollisionObserver(observer: CollisionObserver): void {
    this.asteroidBelt.removeCollisionObserver(observer);
    this.massiveAsteroidField.removeCollisionObserver(observer);
    this.shipCollisions.removeCollisionObserver(observer);
    this.laserField.removeCollisionObserver(observer);
    this.pirateField.removeCollisionObserver(observer);
    this.droneField.removeCollisionObserver(observer);
    this.stationMaze.removeCollisionObserver(observer);
  }
  addDamageObserver(observer: DamageObserver): void {
    this.shipCollisions.addDamageObserver(observer);
    this.droneField.addDamageObserver(observer);
    this.pirateField.addDamageObserver(observer);
  }
  removeDamageObserver(observer: DamageObserver): void {
    this.shipCollisions.removeDamageObserver(observer);
    this.droneField.removeDamageObserver(observer);
    this.pirateField.removeDamageObserver(observer);
  }
  addDroneDestroyedObserver(observer: DroneDestroyedObserver): void { this.droneField.addDroneDestroyedObserver(observer); }
  removeDroneDestroyedObserver(observer: DroneDestroyedObserver): void { this.droneField.removeDroneDestroyedObserver(observer); }
  addPirateDestroyedObserver(observer: PirateDestroyedObserver): void { this.pirateField.addPirateDestroyedObserver(observer); }
  removePirateDestroyedObserver(observer: PirateDestroyedObserver): void { this.pirateField.removePirateDestroyedObserver(observer); }
  addAsteroidDestroyedObserver(observer: AsteroidDestroyedObserver): void {
    this.asteroidBelt.addAsteroidDestroyedObserver(observer);
  }
  removeAsteroidDestroyedObserver(observer: AsteroidDestroyedObserver): void {
    this.asteroidBelt.removeAsteroidDestroyedObserver(observer);
  }
  addLaserShotObserver(observer: LaserShotObserver): void { this.laserField.addLaserShotObserver(observer); }
  removeLaserShotObserver(observer: LaserShotObserver): void { this.laserField.removeLaserShotObserver(observer); }
  addLaserImpactObserver(observer: LaserImpactObserver): void {
    this.laserField.addLaserImpactObserver(observer);
    this.pirateField.addLaserImpactObserver(observer);
  }
  removeLaserImpactObserver(observer: LaserImpactObserver): void {
    this.laserField.removeLaserImpactObserver(observer);
    this.pirateField.removeLaserImpactObserver(observer);
  }
  addAsteroidCollisionObserver(observer: AsteroidCollisionObserver): void {
    this.asteroidBelt.addAsteroidCollisionObserver(observer);
    this.massiveAsteroidField.addAsteroidCollisionObserver(observer);
  }
  removeAsteroidCollisionObserver(observer: AsteroidCollisionObserver): void {
    this.asteroidBelt.removeAsteroidCollisionObserver(observer);
    this.massiveAsteroidField.removeAsteroidCollisionObserver(observer);
  }
  addCollectablePickupObserver(observer: CollectablePickupObserver): void {
    this.supplyField.addCollectablePickupObserver(observer);
    this.stationMaze.addCollectablePickupObserver(observer);
  }
  removeCollectablePickupObserver(observer: CollectablePickupObserver): void {
    this.supplyField.removeCollectablePickupObserver(observer);
    this.stationMaze.removeCollectablePickupObserver(observer);
  }

  onDestroyed(event: AsteroidDestroyed): void {
    if (Math.random() >= DROP_PROBABILITY) return;
    this.supplyField.drop(this.createDrop(event.position));
  }

  onPirateDestroyed(event: PirateDestroyed): void {
    if (Math.random() < PIRATE_WEAPON_DROP_PROBABILITY) {
      this.supplyField.drop(new WeaponPod({ ...event.position }));
    }
    if (Math.random() < DROP_PROBABILITY) {
      this.supplyField.drop(this.createDrop(event.position));
    }
  }

  onDroneDestroyed(event: DroneDestroyed): void {
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

  private clearMissionEncounters(): void {
    this.asteroidBelt.clear();
    this.supplyField.clear();
    this.droneField.clear();
    this.pirateField.clear();
    this.laserField.clear();
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
    const mode = this.mission.spawnMode;
    const mission2EncountersEnabled = mode === SpawnMode.Mission2Travel
      && this.mission.encounterSpawningAllowed;
    const asteroidsEnabled = mode === SpawnMode.Normal || mission2EncountersEnabled;
    const islands = mode === SpawnMode.Mission2Travel;
    const suppliesEnabled = mode === SpawnMode.Normal;
    const massiveEnabled = mode === SpawnMode.Normal;
    const dronesEnabled = mode === SpawnMode.Normal;
    const piratesEnabled = mission2EncountersEnabled
      && this.mission.distanceRemaining <= this.mission.initialTravelDistance * 0.75;
    this.asteroidBelt.update(dt, this.ship.position, spawnBoundary, asteroidsEnabled, islands, this.mission.signalDirection);
    this.supplyField.update(dt, this.ship, this.asteroidBelt, spawnBoundary, this.spawnExclusionRadius, suppliesEnabled);
    this.massiveAsteroidField.prepareAround(this.ship.position, spawnBoundary, massiveEnabled);
    this.massiveAsteroidField.resolveBodyCollisions(this.asteroidBelt, this.supplyField);
    this.stationMaze.resolveBodyCollisions(this.asteroidBelt, this.supplyField);
    this.droneField.update(dt, this.ship, this.asteroidBelt, this.massiveAsteroidField, spawnBoundary, dronesEnabled, mission2EncountersEnabled);
    this.pirateField.update(dt, this.ship, this.asteroidBelt, this.massiveAsteroidField, spawnBoundary, piratesEnabled, this.mission.isTraversal ? this.mission.signalDirection : null, this.discoveredMap);
    const droneBodies: PhysicsBody[] = [];
    this.droneField.forEach((drone) => droneBodies.push(drone));
    const pirateBodies: PhysicsBody[] = [];
    this.pirateField.forEachPirate((pirate) => pirateBodies.push(pirate));
    this.droneField.applySeparation(pirateBodies, dt);
    this.pirateField.applySeparation(droneBodies, dt);
    this.laserField.update(dt, this.ship, this.asteroidBelt, this.massiveAsteroidField, this.spawnExclusionRadius, this.droneField, this.pirateField, this.stationMaze);

    const obstacles: ShipObstacle[] = [];
    this.asteroidBelt.forEach((asteroid) => obstacles.push(asteroid));
    this.massiveAsteroidField.forEachActive((asteroid) => obstacles.push(asteroid));
    this.stationMaze.forEachObstacleNear(this.ship.position, spawnBoundary + this.ship.radius * 2, (obstacle) => obstacles.push(obstacle));
    this.shipCollisions.resolve(this.ship, obstacles, dt);

    this.stationMaze.update(dt, this.ship, this.asteroidBelt, this.droneField, this.pirateField, this.laserField);
    this.mission.update(dt, this.ship, this.droneField, this.asteroidBelt, this.massiveAsteroidField, this.stationMaze, this.visitedMap, this.spawnExclusionRadius);
  }
}
