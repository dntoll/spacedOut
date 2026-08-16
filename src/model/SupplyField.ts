import type { Vec2 } from '../types';
import type { AsteroidBelt } from './AsteroidBelt';
import type { Ship } from './Ship';
import type { SupplyContainer } from './SupplyContainer';
import { SupplyRegion } from './SupplyRegion';

export class SupplyField {
  static readonly regionSize = 1200;
  private readonly regions = new Map<number, Map<number, SupplyRegion>>();
  private activeRegions: SupplyRegion[] = [];

  constructor(
    center: Vec2,
    initialContainers?: SupplyContainer[],
    private readonly worldSeed = Math.floor(Math.random() * 0x1_0000_0000),
  ) {
    if (initialContainers) {
      const { column, row } = this.coordinatesAt(center);
      this.storeRegion(new SupplyRegion(column, row, SupplyField.regionSize, worldSeed, initialContainers));
    }
    this.activateAround(center, 4000);
    this.activateAround(center, 1500);
  }

  update(dt: number, ship: Ship, asteroidBelt: AsteroidBelt, spawnExclusionRadius = 1500): void {
    this.activateAround(ship.position, spawnExclusionRadius);
    for (const region of this.activeRegions) region.update(dt, ship, asteroidBelt);
  }

  forEachActive(visitor: (container: SupplyContainer) => void): void {
    for (const region of this.activeRegions) region.forEach(visitor);
  }

  forEachKnown(visitor: (container: SupplyContainer) => void): void {
    for (const rows of this.regions.values()) {
      for (const region of rows.values()) region.forEach(visitor);
    }
  }

  private activateAround(center: Vec2, spawnExclusionRadius: number): void {
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
      ) active.push(this.getOrCreateRegion(column, row));
    }
    this.activeRegions = active;
  }

  private getOrCreateRegion(column: number, row: number): SupplyRegion {
    const existing = this.regions.get(column)?.get(row);
    if (existing) return existing;
    const region = new SupplyRegion(column, row, SupplyField.regionSize, this.worldSeed);
    this.storeRegion(region);
    return region;
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
