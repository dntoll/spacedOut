import { clamp } from '../math';
import type { Bounds, Vec2 } from '../types';

export class DiscoveredMap {
  static readonly cellSize = 250;
  private readonly discoveredRows = new Map<number, Set<number>>();

  reset(): void { this.discoveredRows.clear(); }

  record(bounds: Bounds): void {
    this.forEachCoordinate(bounds, (column, row) => {
      let rows = this.discoveredRows.get(column);
      if (!rows) {
        rows = new Set<number>();
        this.discoveredRows.set(column, rows);
      }
      rows.add(row);
    });
  }

  isCircleDiscovered(position: Vec2, radius: number): boolean {
    let discovered = false;
    this.forEachCoordinate({
      left: position.x - radius,
      top: position.y - radius,
      right: position.x + radius,
      bottom: position.y + radius,
    }, (column, row) => {
      if (discovered) return;
      if (!this.discoveredRows.get(column)?.has(row)) return;
      const cellLeft = column * DiscoveredMap.cellSize;
      const cellRight = cellLeft + DiscoveredMap.cellSize;
      const cellTop = row * DiscoveredMap.cellSize;
      const cellBottom = cellTop + DiscoveredMap.cellSize;
      const closestX = clamp(position.x, cellLeft, cellRight);
      const closestY = clamp(position.y, cellTop, cellBottom);
      const dx = position.x - closestX;
      const dy = position.y - closestY;
      if (dx * dx + dy * dy <= radius * radius) discovered = true;
    });
    return discovered;
  }

  private forEachCoordinate(bounds: Bounds, visitor: (column: number, row: number) => void): void {
    const firstColumn = Math.floor(bounds.left / DiscoveredMap.cellSize);
    const lastColumn = Math.floor(bounds.right / DiscoveredMap.cellSize);
    const firstRow = Math.floor(bounds.top / DiscoveredMap.cellSize);
    const lastRow = Math.floor(bounds.bottom / DiscoveredMap.cellSize);
    for (let column = firstColumn; column <= lastColumn; column++) {
      for (let row = firstRow; row <= lastRow; row++) visitor(column, row);
    }
  }
}
