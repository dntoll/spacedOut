import type { Vec2 } from '../types';
import type { AsteroidBelt } from './AsteroidBelt';
import { CollectablePickup } from './CollectablePickup';
import type { CollectablePickupObserver } from './CollectablePickupObserver';
import { RandomSequence } from './RandomSequence';
import type { Ship } from './Ship';
import { SupplyChooser, SupplyType } from './SupplyChooser';
import type { SupplyContainer } from './SupplyContainer';
import { SupplyRegion } from './SupplyRegion';

export class SupplyField {
  static readonly regionSize = 1800;
  private readonly regions = new Map<number, Map<number, SupplyRegion>>();
  private activeRegions: SupplyRegion[] = [];
  private readonly drops: SupplyContainer[] = [];
  private readonly pickupObservers = new Set<CollectablePickupObserver>();
  private readonly emitPickup = (position: Vec2): void => {
    const event = new CollectablePickup({ ...position });
    for (const observer of this.pickupObservers) observer.onCollectablePickup(event);
  };

  constructor(
    center: Vec2,
    initialContainers?: SupplyContainer[],
    private readonly worldSeed = Math.floor(Math.random() * 0x1_0000_0000),
  ) {
    if (initialContainers) {
      const { column, row } = this.coordinatesAt(center);
      this.storeRegion(new SupplyRegion(column, row, SupplyField.regionSize, worldSeed, initialContainers, undefined, this.emitPickup));
    }
    this.activateAround(center, 4000);
    this.activateAround(center, 1500);
  }

  update(dt: number, ship: Ship, asteroidBelt: AsteroidBelt, spawnExclusionRadius = 1500, visibleRadius = spawnExclusionRadius): void {
    this.activateAround(ship.position, spawnExclusionRadius, ship, visibleRadius);
    for (const region of this.activeRegions) region.update(dt, ship, asteroidBelt);
    this.updateDrops(dt, ship, asteroidBelt);
  }

  drop(container: SupplyContainer): void { this.drops.push(container); }

  visibleTypes(ship: Ship, visibleRadius: number): Set<SupplyType> {
    const types = new Set<SupplyType>();
    const radiusSquared = visibleRadius * visibleRadius;
    this.forEachActive((container) => {
      const dx = container.position.x - ship.position.x;
      const dy = container.position.y - ship.position.y;
      if (dx * dx + dy * dy <= radiusSquared) types.add(container.type);
    });
    return types;
  }

  addCollectablePickupObserver(observer: CollectablePickupObserver): void { this.pickupObservers.add(observer); }
  removeCollectablePickupObserver(observer: CollectablePickupObserver): void { this.pickupObservers.delete(observer); }

  forEachActive(visitor: (container: SupplyContainer) => void): void {
    for (const region of this.activeRegions) region.forEach(visitor);
    for (const drop of this.drops) visitor(drop);
  }

  forEachKnown(visitor: (container: SupplyContainer) => void): void {
    for (const rows of this.regions.values()) {
      for (const region of rows.values()) region.forEach(visitor);
    }
    for (const drop of this.drops) visitor(drop);
  }

  private updateDrops(dt: number, ship: Ship, asteroidBelt: AsteroidBelt): void {
    for (let index = this.drops.length - 1; index >= 0; index--) {
      const container = this.drops[index];
      container.attractToward(ship);
      container.integrate(dt);
      asteroidBelt.collideWith(container);

      const dx = container.position.x - ship.position.x;
      const dy = container.position.y - ship.position.y;
      const collectionRadius = container.radius + ship.radius;
      if (dx * dx + dy * dy <= collectionRadius * collectionRadius) {
        container.collect(ship);
        this.emitPickup(container.position);
        this.drops.splice(index, 1);
      }
    }
  }

  private activateAround(center: Vec2, spawnExclusionRadius: number, ship?: Ship, visibleRadius?: number): void {
    const centerCoordinates = this.coordinatesAt(center);
    const activeRadius = Math.max(2, Math.ceil(spawnExclusionRadius / SupplyField.regionSize) + 1);
    const active: SupplyRegion[] = [];
    for (
      let column = centerCoordinates.column - activeRadius;
      column <= centerCoordinates.column + activeRadius;
      column++
    ) {
      for (
        let row = centerCoordinates.row - activeRadius;
        row <= centerCoordinates.row + activeRadius;
        row++
      ) active.push(this.getOrCreateRegion(column, row, ship, visibleRadius));
    }
    this.activeRegions = active;
  }

  private getOrCreateRegion(column: number, row: number, ship?: Ship, visibleRadius?: number): SupplyRegion {
    const existing = this.regions.get(column)?.get(row);
    if (existing) return existing;
    const chosenType = ship ? this.chooseType(ship, column, row, visibleRadius ?? 0) : undefined;
    const region = new SupplyRegion(column, row, SupplyField.regionSize, this.worldSeed, undefined, chosenType, this.emitPickup);
    this.storeRegion(region);
    return region;
  }

  private chooseType(ship: Ship, column: number, row: number, visibleRadius: number): SupplyType {
    const random = new RandomSequence(SupplyRegion.seedFor(column, row, this.worldSeed));
    const visible = this.visibleTypes(ship, visibleRadius);
    return SupplyChooser.choose({ fuel: ship.fuel, hp: ship.hp, ammo: ship.ammo }, visible, () => random.next());
  }

  private storeRegion(region: SupplyRegion): void {
    let rows = this.regions.get(region.column);
    if (!rows) {
      rows = new Map<number, SupplyRegion>();
      this.regions.set(region.column, rows);
    }
    rows.set(region.row, region);
  }

  private coordinatesAt(position: Vec2): { column: number; row: number } {
    return {
      column: Math.floor(position.x / SupplyField.regionSize),
      row: Math.floor(position.y / SupplyField.regionSize),
    };
  }
}
