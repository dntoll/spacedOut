import { length, random, sub } from '../math';
import type { Vec2 } from '../types';
import type { AsteroidBelt } from './AsteroidBelt';
import { Damage } from './Damage';
import type { DamageObserver } from './DamageObserver';
import { Drone } from './Drone';
import { DroneDestroyed } from './DroneDestroyed';
import type { DroneDestroyedObserver } from './DroneDestroyedObserver';
import { MassiveAsteroid } from './MassiveAsteroid';
import type { MassiveAsteroidField } from './MassiveAsteroidField';
import type { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';

const TARGET_POPULATION = 24;
const DETACH_RANGE_RADII = 12;
const DRONE_IMPACT_DAMAGE = 20;
const MENACE_RANGE = 700;
const MASSIVE_CAPACITY_MAX = 6;

export class DroneField {
  private readonly drones: Drone[] = [];
  private readonly damageObservers = new Set<DamageObserver>();
  private readonly destroyedObservers = new Set<DroneDestroyedObserver>();
  private readonly massiveCapacity = new Map<MassiveAsteroid, number>();

  constructor(initialDrones?: Drone[]) {
    if (initialDrones) this.drones.push(...initialDrones);
  }

  forEach(visitor: (drone: Drone) => void): void { this.drones.forEach(visitor); }
  get count(): number { return this.drones.length; }
  has(drone: Drone): boolean { return this.drones.includes(drone); }

  menace(center: Vec2): number {
    let sum = 0;
    const range = MENACE_RANGE;
    for (const drone of this.drones) {
      const dx = drone.position.x - center.x;
      const dy = drone.position.y - center.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= range) continue;
      sum += 1 - dist / range;
    }
    return Math.min(1, sum);
  }

  addDamageObserver(observer: DamageObserver): void { this.damageObservers.add(observer); }
  removeDamageObserver(observer: DamageObserver): void { this.damageObservers.delete(observer); }
  addDroneDestroyedObserver(observer: DroneDestroyedObserver): void { this.destroyedObservers.add(observer); }
  removeDroneDestroyedObserver(observer: DroneDestroyedObserver): void { this.destroyedObservers.delete(observer); }

  applyLaserHit(drone: Drone, position: Vec2): void {
    const index = this.drones.indexOf(drone);
    if (index < 0) return;
    const killed = drone.takeLaserHit();
    if (!killed) {
      drone.detach();
      return;
    }
    this.drones.splice(index, 1);
    const event = new DroneDestroyed({ ...position });
    for (const observer of this.destroyedObservers) observer.onDroneDestroyed(event);
  }

  update(
    dt: number,
    ship: Ship,
    asteroidBelt: AsteroidBelt,
    massiveAsteroidField: MassiveAsteroidField,
    spawnExclusionRadius: number,
  ): void {
    this.releaseLostHosts(asteroidBelt, massiveAsteroidField);
    this.detachInRange(ship);
    this.rideAndHunt(dt, ship, massiveAsteroidField);
    this.resolveShipImpacts(ship);
    this.recycleDistant(ship.position, spawnExclusionRadius);
    this.spawnToTarget(ship, asteroidBelt, massiveAsteroidField, spawnExclusionRadius);
  }

  private releaseLostHosts(asteroidBelt: AsteroidBelt, massiveAsteroidField: MassiveAsteroidField): void {
    for (const drone of this.drones) {
      if (!drone.host) continue;
      const alive = drone.host instanceof MassiveAsteroid
        ? massiveAsteroidField.has(drone.host)
        : asteroidBelt.has(drone.host as never);
      if (!alive) drone.detach();
    }
  }

  private detachInRange(ship: Ship): void {
    const range = ship.radius * DETACH_RANGE_RADII;
    const rangeSq = range * range;
    for (const drone of this.drones) {
      if (!drone.host) continue;
      const dx = drone.position.x - ship.position.x;
      const dy = drone.position.y - ship.position.y;
      if (dx * dx + dy * dy <= rangeSq) drone.detach();
    }
  }

  awakenNearby(ship: Ship, radius: number): void {
    const radiusSq = radius * radius;
    for (const drone of this.drones) {
      if (!drone.host) continue;
      const dx = drone.position.x - ship.position.x;
      const dy = drone.position.y - ship.position.y;
      if (dx * dx + dy * dy <= radiusSq) drone.detach();
    }
  }

  private rideAndHunt(dt: number, ship: Ship, massiveAsteroidField: MassiveAsteroidField): void {
    for (const drone of this.drones) {
      if (drone.host) drone.rideHost(drone.host instanceof MassiveAsteroid ? massiveAsteroidField : null);
      else drone.hunt(dt, ship);
    }
  }

  private resolveShipImpacts(ship: Ship): void {
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const drone = this.drones[i];
      const dx = drone.position.x - ship.position.x;
      const dy = drone.position.y - ship.position.y;
      const reach = drone.radius + ship.radius;
      if (dx * dx + dy * dy > reach * reach) continue;
      if (!ship.isInvulnerable) {
        ship.takeDamage(DRONE_IMPACT_DAMAGE);
        const lethal = !ship.isAlive;
        for (const observer of this.damageObservers) {
          observer.onDamage(new Damage({ ...drone.position }, DRONE_IMPACT_DAMAGE, lethal));
        }
      }
      this.drones.splice(i, 1);
    }
  }

  private recycleDistant(center: Vec2, spawnExclusionRadius: number): void {
    const spawnInner = Math.max(1050, spawnExclusionRadius + 180);
    const recycleRadius = spawnInner + 800;
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const drone = this.drones[i];
      if (drone.host) continue;
      if (length(sub(drone.position, center)) > recycleRadius) this.drones.splice(i, 1);
    }
  }

  private spawnToTarget(
    ship: Ship,
    asteroidBelt: AsteroidBelt,
    massiveAsteroidField: MassiveAsteroidField,
    spawnExclusionRadius: number,
  ): void {
    const spawnInner = Math.max(1050, spawnExclusionRadius + 180);
    const hostCounts = new Map<PhysicsBody, number>();
    for (const drone of this.drones) {
      if (drone.host) hostCounts.set(drone.host, (hostCounts.get(drone.host) ?? 0) + 1);
    }
    this.pruneStaleCapacities(massiveAsteroidField);

    while (this.drones.length < TARGET_POPULATION) {
      const host = this.pickHost(ship.position, asteroidBelt, massiveAsteroidField, spawnInner, hostCounts);
      if (!host) break;
      const drone = new Drone(host, random(0, Math.PI * 2), Drone.createBodyVertices(), Math.floor(random(1, 4)));
      drone.rideHost(host instanceof MassiveAsteroid ? massiveAsteroidField : null);
      this.drones.push(drone);
      hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
    }
  }

  private capacityFor(host: PhysicsBody, massiveAsteroidField: MassiveAsteroidField): number {
    if (!(host instanceof MassiveAsteroid)) return 1;
    let cap = this.massiveCapacity.get(host);
    if (cap === undefined) {
      cap = Math.floor(random(1, MASSIVE_CAPACITY_MAX + 1));
      this.massiveCapacity.set(host, cap);
    }
    return cap;
  }

  private pruneStaleCapacities(massiveAsteroidField: MassiveAsteroidField): void {
    if (this.massiveCapacity.size === 0) return;
    for (const key of this.massiveCapacity.keys()) {
      if (!massiveAsteroidField.has(key)) this.massiveCapacity.delete(key);
    }
  }

  private pickHost(
    center: Vec2,
    asteroidBelt: AsteroidBelt,
    massiveAsteroidField: MassiveAsteroidField,
    spawnInner: number,
    hostCounts: Map<PhysicsBody, number>,
  ): PhysicsBody | null {
    const weighted: { host: PhysicsBody; weight: number }[] = [];
    asteroidBelt.forEach((asteroid) => {
      if (length(sub(asteroid.position, center)) < spawnInner) return;
      const count = hostCounts.get(asteroid) ?? 0;
      if (count >= 1) return;
      weighted.push({ host: asteroid, weight: 1 });
    });
    massiveAsteroidField.forEachActive((asteroid) => {
      if (length(sub(asteroid.position, center)) < spawnInner) return;
      const cap = this.capacityFor(asteroid, massiveAsteroidField);
      const count = hostCounts.get(asteroid) ?? 0;
      const remaining = cap - count;
      if (remaining <= 0) return;
      weighted.push({ host: asteroid, weight: remaining });
    });
    if (weighted.length === 0) return null;
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) return entry.host;
    }
    return weighted[weighted.length - 1].host;
  }
}
