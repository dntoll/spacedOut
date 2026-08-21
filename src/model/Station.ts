import { length, sub } from '../math';
import type { Vec2 } from '../types';
import type { AsteroidBelt } from './AsteroidBelt';
import type { CollisionObserver } from './CollisionObserver';
import { CollisionResolver } from './CollisionResolver';
import { CollectablePickup } from './CollectablePickup';
import type { CollectablePickupObserver } from './CollectablePickupObserver';
import { AmmoContainer } from './AmmoContainer';
import { FuelContainer } from './FuelContainer';
import { HpContainer } from './HpContainer';
import { boundaryRadiusAt } from './MassiveAsteroid';
import type { DroneField } from './DroneField';
import type { LaserField } from './LaserField';
import type { PirateField } from './PirateField';
import type { Ship } from './Ship';
import { StationGate } from './StationGate';
import { StationMachinery } from './StationMachinery';
import { StationGenerator, type StationLayout, type StationRoomInstance } from './StationGenerator';
import type { StationCarver } from './StationCarver';
import { StationContour } from './StationContour';
import { StationSwitch } from './StationSwitch';
import type { ShipObstacle, WallChain, PolygonObstacle } from './SweptCircleCollision';
import { isWallChain } from './SweptCircleCollision';
import { resolveWallChainBody, wallChainHit } from './WallChainCollision';
import { SupplyType } from './SupplyChooser';
import type { SupplyContainer } from './SupplyContainer';
import type { SupplyField } from './SupplyField';
import type { PhysicsBody } from './PhysicsBody';

const CENTRAL_REACH_MARGIN = 1.05;

export class Station {
  private layout: StationLayout | null = null;
  private readonly pickupObservers = new Set<CollectablePickupObserver>();
  private readonly collisionObservers = new Set<CollisionObserver>();
  private collectibleContainers: SupplyContainer[] = [];
  private readonly emitPickup = (position: Vec2): void => {
    const event = new CollectablePickup({ ...position });
    for (const observer of this.pickupObservers) observer.onCollectablePickup(event);
  };

  get isPlaced(): boolean { return this.layout !== null; }
  get center(): Vec2 | null { return this.layout ? { ...this.layout.center } : null; }
  get outerRadius(): number { return this.layout?.outerRadius ?? 0; }
  get entrancePosition(): Vec2 | null { return this.layout ? { ...this.layout.entrancePosition } : null; }
  get entranceAngle(): number { return this.layout?.entranceAngle ?? 0; }
  get entranceRadius(): number { return this.layout?.entranceRadius ?? 0; }
  get centralCenter(): Vec2 | null { return this.layout ? { ...this.layout.centralCenter } : null; }
  get centralRadius(): number { return this.layout?.centralRadius ?? 0; }
  get carver(): StationCarver | null { return this.layout?.carver ?? null; }
  get rooms(): readonly StationRoomInstance[] { return this.layout ? this.layout.rooms : []; }
  get switchRoomIds(): readonly string[] { return this.layout ? this.layout.switchRoomIds : []; }
  get entranceCell(): { c: number; r: number } | null { return this.layout ? { ...this.layout.entranceCell } : null; }
  get centralCell(): { c: number; r: number } | null { return this.layout ? { ...this.layout.centralCell } : null; }
  get switchCells(): readonly { c: number; r: number }[] { return this.layout ? this.layout.switchCells.map((c) => ({ ...c })) : []; }
  gateCells(index: number): readonly { c: number; r: number }[] { return this.layout?.gateCells[index - 1]?.map((c) => ({ ...c })) ?? []; }
  roomById(id: string): StationRoomInstance | undefined { return this.layout?.rooms.find((r) => r.id === id); }

  placeAt(center: Vec2, outerRadius: number, entranceAngle: number, seed: number): void {
    this.layout = StationGenerator.generate(center, outerRadius, entranceAngle, seed);
    this.collectibleContainers = this.layout.collectibles.map((spec) => this.createContainer(spec.type, spec.position));
  }

  clear(): void {
    this.layout = null;
    this.collectibleContainers = [];
  }

  isGateOpen(index: number): boolean {
    const gate = this.findGate(index);
    return gate ? gate.open : false;
  }

  isSwitchActivated(index: number): boolean {
    const sw = this.findSwitch(index);
    return sw ? sw.activated : false;
  }

  isCentralReached(ship: Ship): boolean {
    if (!this.layout) return false;
    return length(sub(ship.position, this.layout.centralCenter)) <= this.layout.centralRadius * CENTRAL_REACH_MARGIN;
  }

  forEachHullWall(visitor: (wall: StationContour) => void): void {
    if (!this.layout) return;
    visitor(this.layout.hullContour);
  }

  forEachInteriorWall(visitor: (wall: StationContour) => void): void {
    if (!this.layout) return;
    this.layout.interiorContours.forEach(visitor);
  }

  forEachWall(visitor: (wall: StationContour) => void): void {
    if (!this.layout) return;
    visitor(this.layout.hullContour);
    this.layout.interiorContours.forEach(visitor);
  }

  forEachGate(visitor: (gate: StationGate) => void): void { this.layout?.gates.forEach(visitor); }
  forEachSwitch(visitor: (sw: StationSwitch) => void): void { this.layout?.switches.forEach(visitor); }
  forEachMachinery(visitor: (m: StationMachinery) => void): void { this.layout?.machinery.forEach(visitor); }
  forEachCollectible(visitor: (c: SupplyContainer) => void): void { this.collectibleContainers.forEach(visitor); }

  forEachObstacle(visitor: (obstacle: ShipObstacle) => void): void {
    if (!this.layout) return;
    visitor(this.layout.hullContour);
    this.layout.interiorContours.forEach(visitor);
    for (const gate of this.layout.gates) if (!gate.open) visitor(gate);
    this.layout.machinery.forEach(visitor);
  }

  forEachObstacleNear(position: Vec2, radius: number, visitor: (obstacle: ShipObstacle) => void): void {
    if (!this.layout) return;
    this.forEachObstacle((obstacle) => {
      const dx = obstacle.position.x - position.x;
      const dy = obstacle.position.y - position.y;
      const reach = radius + obstacle.radius;
      if (dx * dx + dy * dy <= reach * reach) visitor(obstacle);
    });
  }

  resolveBodyCollisions(asteroidBelt: AsteroidBelt, supplyField: SupplyField): void {
    if (!this.layout) return;
    const resolve = (body: PhysicsBody, obstacle: ShipObstacle): void => {
      const collision = isWallChain(obstacle)
        ? resolveWallChainBody(body, obstacle as WallChain)
        : CollisionResolver.resolveAgainstStaticBoundary(body, obstacle.position, boundaryRadiusAt(obstacle as PolygonObstacle, body.position));
      if (collision) for (const observer of this.collisionObservers) observer.onCollision(collision);
    };
    this.forEachObstacle((obstacle) => {
      asteroidBelt.forEach((asteroid) => resolve(asteroid, obstacle));
      supplyField.forEachActive((container) => resolve(container, obstacle));
    });
  }

  update(
    dt: number,
    ship: Ship,
    asteroidBelt: AsteroidBelt,
    droneField: DroneField,
    pirateField: PirateField,
    laserField: LaserField,
  ): void {
    if (!this.layout) return;
    this.updateSwitches(ship, asteroidBelt, droneField, pirateField, laserField);
    this.updateCollectibles(dt, ship);
  }

  addCollectablePickupObserver(observer: CollectablePickupObserver): void { this.pickupObservers.add(observer); }
  removeCollectablePickupObserver(observer: CollectablePickupObserver): void { this.pickupObservers.delete(observer); }
  addCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.add(observer); }
  removeCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.delete(observer); }

  private updateSwitches(ship: Ship, asteroidBelt: AsteroidBelt, droneField: DroneField, pirateField: PirateField, laserField: LaserField): void {
    for (const sw of this.layout!.switches) {
      if (sw.activated) continue;
      const hit = this.switchHitBy(sw, ship, asteroidBelt, droneField, pirateField, laserField);
      if (hit) {
        sw.activate();
        const gate = this.findGate(sw.index);
        if (gate) gate.open = true;
      }
    }
  }

  private switchHitBy(
    sw: StationSwitch,
    ship: Ship,
    asteroidBelt: AsteroidBelt,
    droneField: DroneField,
    pirateField: PirateField,
    laserField: LaserField,
  ): boolean {
    if (this.overlaps(sw.position, sw.radius, ship.position, ship.radius)) return true;
    let hit = false;
    asteroidBelt.forEach((asteroid) => {
      if (!hit && this.overlaps(sw.position, sw.radius, asteroid.position, asteroid.radius)) hit = true;
    });
    droneField.forEach((drone) => {
      if (!hit && this.overlaps(sw.position, sw.radius, drone.position, drone.radius)) hit = true;
    });
    pirateField.forEachPirate((pirate) => {
      if (!hit && this.overlaps(sw.position, sw.radius, pirate.position, pirate.radius)) hit = true;
    });
    laserField.forEach((laser) => {
      if (!hit && this.overlaps(sw.position, sw.radius, laser.position, laser.radius)) hit = true;
    });
    return hit;
  }

  private overlaps(a: Vec2, ar: number, b: Vec2, br: number): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const reach = ar + br;
    return dx * dx + dy * dy <= reach * reach;
  }

  private updateCollectibles(dt: number, ship: Ship): void {
    for (let i = this.collectibleContainers.length - 1; i >= 0; i--) {
      const container = this.collectibleContainers[i];
      container.attractToward(ship);
      container.integrate(dt);
      this.collideCollectibleWithWalls(container);
      const dx = container.position.x - ship.position.x;
      const dy = container.position.y - ship.position.y;
      const collectionRadius = container.radius + ship.radius;
      if (dx * dx + dy * dy <= collectionRadius * collectionRadius) {
        container.collect(ship);
        this.emitPickup(container.position);
        this.collectibleContainers.splice(i, 1);
      }
    }
  }

  private collideCollectibleWithWalls(container: SupplyContainer): void {
    if (!this.layout) return;
    const reach = container.radius + 200;
    this.forEachObstacle((obstacle) => {
      const dx = obstacle.position.x - container.position.x;
      const dy = obstacle.position.y - container.position.y;
      if (dx * dx + dy * dy > (reach + obstacle.radius) * (reach + obstacle.radius)) return;
      if (isWallChain(obstacle)) {
        resolveWallChainBody(container, obstacle as WallChain);
      } else {
        const boundary = boundaryRadiusAt(obstacle as PolygonObstacle, container.position);
        CollisionResolver.resolveAgainstStaticBoundary(container, obstacle.position, boundary);
      }
    });
  }

  private findGate(index: number): StationGate | undefined {
    return this.layout?.gates.find((gate) => gate.index === index);
  }

  private findSwitch(index: number): StationSwitch | undefined {
    return this.layout?.switches.find((sw) => sw.index === index);
  }

  private createContainer(type: SupplyType, position: Vec2): SupplyContainer {
    if (type === SupplyType.Fuel) return new FuelContainer({ ...position });
    if (type === SupplyType.Hp) return new HpContainer({ ...position });
    return new AmmoContainer({ ...position });
  }
}
