import { add, clamp, dot, length, normalize, random, scale, sub } from '../math';
import type { Vec2 } from '../types';
import type { Asteroid } from './Asteroid';
import type { AsteroidBelt } from './AsteroidBelt';
import { Damage } from './Damage';
import type { DamageObserver } from './DamageObserver';
import { Laser } from './Laser';
import type { LaserImpactObserver } from './LaserImpactObserver';
import { Collision } from './Collision';
import type { CollisionObserver } from './CollisionObserver';
import { CollisionResolver } from './CollisionResolver';
import { DamageCalculator } from './DamageCalculator';
import { Pirate, PIRATE_LASER_DAMAGE } from './Pirate';
import { PirateDestroyed } from './PirateDestroyed';
import type { PirateDestroyedObserver } from './PirateDestroyedObserver';
import type { MassiveAsteroid } from './MassiveAsteroid';
import type { MassiveAsteroidField } from './MassiveAsteroidField';
import type { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';

const TARGET_COMBAT_SQUADS = 1;
const TARGET_PERIPHERAL_SQUADS = 1;
const SQUAD_MIN = 2;
const SQUAD_MAX = 3;
const SQUAD_SPREAD = 280;
const PERIPHERAL_FRACTION = 0.5;
const PERIPHERAL_DORMANT_EXTRA = 2400;
const DETECTION_RADII = 100;
const HUNT_GIVE_UP_RADIUS = 3000;
const LASER_CULL_MARGIN = 80;
const PIRATE_HP = 3;

export class PirateField {
  private readonly pirates: Pirate[] = [];
  private readonly lasers: Laser[] = [];
  private nextSquadId = 0;
  private readonly damageObservers = new Set<DamageObserver>();
  private readonly destroyedObservers = new Set<PirateDestroyedObserver>();
  private readonly collisionObservers = new Set<CollisionObserver>();
  private readonly laserImpactObservers = new Set<LaserImpactObserver>();

  constructor(initialPirates?: Pirate[]) {
    if (initialPirates) this.pirates.push(...initialPirates);
  }

  forEachPirate(visitor: (pirate: Pirate) => void): void { this.pirates.forEach(visitor); }
  forEachLaser(visitor: (laser: Laser) => void): void { this.lasers.forEach(visitor); }
  get count(): number { return this.pirates.length; }
  has(pirate: Pirate): boolean { return this.pirates.includes(pirate); }

  clear(): void {
    this.pirates.length = 0;
    this.lasers.length = 0;
    this.nextSquadId = 0;
  }

  anyHunting(): boolean {
    for (const pirate of this.pirates) { if (pirate.awake) return true; }
    return false;
  }

  detectionRange(ship: Ship): number { return ship.radius * DETECTION_RADII; }
  giveUpRadius(): number { return HUNT_GIVE_UP_RADIUS; }

  addDamageObserver(observer: DamageObserver): void { this.damageObservers.add(observer); }
  removeDamageObserver(observer: DamageObserver): void { this.damageObservers.delete(observer); }
  addPirateDestroyedObserver(observer: PirateDestroyedObserver): void { this.destroyedObservers.add(observer); }
  removePirateDestroyedObserver(observer: PirateDestroyedObserver): void { this.destroyedObservers.delete(observer); }
  addCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.add(observer); }
  removeCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.delete(observer); }
  addLaserImpactObserver(observer: LaserImpactObserver): void { this.laserImpactObservers.add(observer); }
  removeLaserImpactObserver(observer: LaserImpactObserver): void { this.laserImpactObservers.delete(observer); }

  applyLaserHit(pirate: Pirate, position: Vec2): void {
    const index = this.pirates.indexOf(pirate);
    if (index < 0) return;
    const killed = pirate.takeLaserHit();
    if (!killed) return;
    this.pirates.splice(index, 1);
    const event = new PirateDestroyed({ ...position });
    for (const observer of this.destroyedObservers) observer.onPirateDestroyed(event);
  }

  update(
    dt: number,
    ship: Ship,
    asteroidBelt: AsteroidBelt,
    massiveAsteroidField: MassiveAsteroidField,
    spawnExclusionRadius: number,
    spawnEnabled = true,
    travelDirection: Vec2 | null = null,
  ): void {
    this.awakenInRange(ship);
    this.rideAndHunt(dt, ship);
    this.resolveAsteroidCollisions(asteroidBelt);
    this.resolveShipCollisions(ship);
    this.updateLasers(dt, ship, asteroidBelt, massiveAsteroidField, spawnExclusionRadius);
    this.recycleDistant(ship, spawnExclusionRadius);
    if (spawnEnabled) this.spawnSquads(ship, spawnExclusionRadius, travelDirection);
  }

  private resolveAsteroidCollisions(asteroidBelt: AsteroidBelt): void {
    for (let i = this.pirates.length - 1; i >= 0; i--) {
      const pirate = this.pirates[i];
      asteroidBelt.forEach((asteroid) => {
        const collision = CollisionResolver.resolve(pirate, asteroid);
        if (!collision) return;
        for (const observer of this.collisionObservers) observer.onCollision(collision);
        if (collision.impactSpeed > DamageCalculator.violentThreshold && pirate.takeImpact()) {
          this.pirates.splice(i, 1);
          const event = new PirateDestroyed({ ...pirate.position });
          for (const observer of this.destroyedObservers) observer.onPirateDestroyed(event);
        }
      });
    }
  }

  private resolveShipCollisions(ship: Ship): void {
    for (let i = this.pirates.length - 1; i >= 0; i--) {
      const pirate = this.pirates[i];
      const collision = CollisionResolver.resolve(pirate, ship);
      if (!collision) continue;
      for (const observer of this.collisionObservers) observer.onCollision(collision);
      if (collision.impactSpeed > DamageCalculator.violentThreshold) {
        if (!ship.isInvulnerable) {
          const damage = DamageCalculator.damageFor(collision.impactSpeed, false);
          ship.takeDamage(damage);
          for (const observer of this.damageObservers) {
            observer.onDamage(new Damage({ ...collision.position }, damage, !ship.isAlive));
          }
        }
        if (pirate.takeImpact()) {
          this.pirates.splice(i, 1);
          const event = new PirateDestroyed({ ...pirate.position });
          for (const observer of this.destroyedObservers) observer.onPirateDestroyed(event);
        }
      }
    }
  }

  applySeparation(others: PhysicsBody[], dt: number): void {
    const bodies: PhysicsBody[] = [...this.pirates, ...others];
    for (const pirate of this.pirates) {
      for (const body of bodies) {
        if (body === pirate) continue;
        const offset = sub(pirate.position, body.position);
        const dist = length(offset);
        const minDist = pirate.radius + body.radius + 20;
        if (dist < minDist && dist > 0.0001) {
          const push = scale(normalize(offset), (minDist - dist) * 0.5);
          pirate.position = add(pirate.position, push);
        }
      }
    }
  }

  private awakenInRange(ship: Ship): void {
    const range = this.detectionRange(ship);
    const rangeSq = range * range;
    for (const pirate of this.pirates) {
      if (pirate.awake) continue;
      const dx = pirate.position.x - ship.position.x;
      const dy = pirate.position.y - ship.position.y;
      if (dx * dx + dy * dy <= rangeSq) pirate.awaken();
    }
  }

  private rideAndHunt(dt: number, ship: Ship): void {
    for (const pirate of this.pirates) {
      if (pirate.awake) {
        pirate.hunt(dt, ship);
        const laser = pirate.tryFire(dt, ship);
        if (laser) this.lasers.push(laser);
      } else {
        pirate.drift(dt);
      }
    }
  }

  private updateLasers(
    dt: number,
    ship: Ship,
    asteroidBelt: AsteroidBelt,
    massiveAsteroidField: MassiveAsteroidField,
    spawnExclusionRadius: number,
  ): void {
    const cullRadius = spawnExclusionRadius + LASER_CULL_MARGIN;
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      const previous = { x: laser.position.x, y: laser.position.y };
      laser.update(dt);
      if (length(sub(laser.position, ship.position)) > cullRadius) {
        this.lasers.splice(i, 1);
        continue;
      }
      const reach = laser.radius + ship.radius;
      if (this.segmentHitsCircle(previous, laser.position, ship.position, reach)) {
        if (!ship.isInvulnerable) {
          ship.takeDamage(PIRATE_LASER_DAMAGE);
          const lethal = !ship.isAlive;
          for (const observer of this.damageObservers) {
            observer.onDamage(new Damage({ ...laser.position }, PIRATE_LASER_DAMAGE, lethal));
          }
        }
        this.emitSpark(laser.position, { x: 0, y: 0 });
        this.lasers.splice(i, 1);
        continue;
      }
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
      const pirateHit = this.pirateHit(laser);
      if (pirateHit) {
        this.emitSpark(laser.position, normalize(sub(laser.position, pirateHit.position)));
        this.applyLaserHit(pirateHit, laser.position);
        this.lasers.splice(i, 1);
        continue;
      }
    }
  }

  private pirateHit(laser: Laser): Pirate | null {
    let hit: Pirate | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const pirate of this.pirates) {
      if (pirate === laser.owner) continue;
      const distance = length(sub(pirate.position, laser.position));
      if (distance <= pirate.radius + laser.radius && distance < bestDistance) {
        bestDistance = distance;
        hit = pirate;
      }
    }
    return hit;
  }

  private segmentHitsCircle(a: Vec2, b: Vec2, center: Vec2, radius: number): boolean {
    const ab = sub(b, a);
    const abLenSq = dot(ab, ab);
    if (abLenSq < 1e-9) {
      const d = sub(center, a);
      return dot(d, d) <= radius * radius;
    }
    const t = clamp(dot(sub(center, a), ab) / abLenSq, 0, 1);
    const closest = add(a, scale(ab, t));
    const d = sub(center, closest);
    return dot(d, d) <= radius * radius;
  }

  private nearestRegularHit(laser: Laser, asteroidBelt: AsteroidBelt): { asteroid: Asteroid } | null {
    let hit: Asteroid | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    asteroidBelt.forEach((asteroid) => {
      const distance = length(sub(asteroid.position, laser.position));
      if (distance <= asteroid.radius + laser.radius && distance < bestDistance) {
        bestDistance = distance;
        hit = asteroid;
      }
    });
    return hit ? { asteroid: hit } : null;
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
    const collision = new Collision({ ...position }, normal, 1400);
    for (const observer of this.collisionObservers) observer.onCollision(collision);
    for (const observer of this.laserImpactObservers) observer.onLaserImpact(collision);
  }

  private recycleDistant(ship: Ship, spawnExclusionRadius: number): void {
    const spawnInner = Math.max(1050, spawnExclusionRadius + 180);
    const dormantRecycle = spawnInner + 800;
    const peripheralRecycle = spawnInner + PERIPHERAL_DORMANT_EXTRA;
    for (let i = this.pirates.length - 1; i >= 0; i--) {
      const pirate = this.pirates[i];
      const dx = pirate.position.x - ship.position.x;
      const dy = pirate.position.y - ship.position.y;
      const distSq = dx * dx + dy * dy;
      let threshold = pirate.awake ? HUNT_GIVE_UP_RADIUS : dormantRecycle;
      if (!pirate.awake && pirate.peripheral) threshold = peripheralRecycle;
      if (distSq > threshold * threshold) this.pirates.splice(i, 1);
    }
  }

  private squadCounts(): { combat: number; peripheral: number } {
    const combat = new Set<number>();
    const peripheral = new Set<number>();
    for (const pirate of this.pirates) {
      if (pirate.squadId < 0) continue;
      (pirate.peripheral ? peripheral : combat).add(pirate.squadId);
    }
    return { combat: combat.size, peripheral: peripheral.size };
  }

  private spawnSquads(ship: Ship, spawnExclusionRadius: number, travelDirection: Vec2 | null): void {
    const detection = this.detectionRange(ship);
    const spawnInner = Math.max(spawnExclusionRadius + 400, detection + 200 + SQUAD_SPREAD);
    const peripheralRecycle = Math.max(1050, spawnExclusionRadius + 180) + PERIPHERAL_DORMANT_EXTRA;
    for (;;) {
      const counts = this.squadCounts();
      if (counts.combat < TARGET_COMBAT_SQUADS) {
        this.spawnSquad(ship, spawnInner, detection, false, null, 0);
        continue;
      }
      if (counts.peripheral < TARGET_PERIPHERAL_SQUADS && travelDirection) {
        this.spawnSquad(ship, spawnInner, detection, true, travelDirection, peripheralRecycle);
        continue;
      }
      break;
    }
  }

  private spawnSquad(
    ship: Ship,
    spawnInner: number,
    detection: number,
    peripheral: boolean,
    travelDirection: Vec2 | null,
    peripheralRecycle: number,
  ): void {
    const squadId = this.nextSquadId++;
    let center: Vec2;
    if (peripheral && travelDirection) {
      const perp: Vec2 = { x: -travelDirection.y, y: travelDirection.x };
      const lateralLo = detection + SQUAD_SPREAD + 400;
      const lateralHi = Math.max(lateralLo + 200, peripheralRecycle - SQUAD_SPREAD - 400);
      const lateral = random(lateralLo, lateralHi) * (random(0, 1) < 0.5 ? 1 : -1);
      const ahead = random(spawnInner * 0.3, spawnInner * 0.7);
      center = add(add(ship.position, scale(travelDirection, ahead)), scale(perp, lateral));
    } else {
      const angle = random(0, Math.PI * 2);
      const distance = random(spawnInner, spawnInner + 600);
      center = { x: ship.position.x + Math.cos(angle) * distance, y: ship.position.y + Math.sin(angle) * distance };
    }
    const members = Math.floor(random(SQUAD_MIN, SQUAD_MAX + 1));
    for (let i = 0; i < members; i++) {
      const offset: Vec2 = { x: random(-SQUAD_SPREAD, SQUAD_SPREAD), y: random(-SQUAD_SPREAD, SQUAD_SPREAD) };
      const position = add(center, offset);
      this.pirates.push(new Pirate(position, Pirate.createBodyVertices(), PIRATE_HP, squadId, peripheral));
    }
  }
}
