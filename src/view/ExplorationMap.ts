import { clamp } from '../math';
import type { Vec2 } from '../types';
import type { WorldBounds } from './Camera';

export class ExplorationMap {
  static readonly cellSize = 250;
  private readonly exploredRows = new Map<number, Set<number>>();

  reset(): void { this.exploredRows.clear(); }

  observe(bounds: WorldBounds): void {
    this.forEachCoordinate(bounds, (column, row) => {
      let rows = this.exploredRows.get(column);
      if (!rows) {
        rows = new Set<number>();
        this.exploredRows.set(column, rows);
      }
      rows.add(row);
    });
  }

  observeLineOfSight(polygon: Vec2[]): void {
    if (polygon.length < 3) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of polygon) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    this.forEachCoordinate({ left: minX, top: minY, right: maxX, bottom: maxY }, (column, row) => {
      const cx = column * ExplorationMap.cellSize + ExplorationMap.cellSize / 2;
      const cy = row * ExplorationMap.cellSize + ExplorationMap.cellSize / 2;
      if (this.pointInPolygon(cx, cy, polygon)) {
        let rows = this.exploredRows.get(column);
        if (!rows) { rows = new Set<number>(); this.exploredRows.set(column, rows); }
        rows.add(row);
      }
    });
  }

  private pointInPolygon(x: number, y: number, polygon: Vec2[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  isExplored(position: Vec2, radius = 0): boolean {
    let explored = false;
    this.forEachCoordinate({
      left: position.x - radius,
      top: position.y - radius,
      right: position.x + radius,
      bottom: position.y + radius,
    }, (column, row) => {
      if (this.exploredRows.get(column)?.has(row)) explored = true;
    });
    return explored;
  }

  isCircleExplored(position: Vec2, radius: number): boolean {
    let explored = false;
    this.forEachCoordinate({
      left: position.x - radius,
      top: position.y - radius,
      right: position.x + radius,
      bottom: position.y + radius,
    }, (column, row) => {
      if (explored) return;
      if (!this.exploredRows.get(column)?.has(row)) return;
      const cellLeft = column * ExplorationMap.cellSize;
      const cellRight = cellLeft + ExplorationMap.cellSize;
      const cellTop = row * ExplorationMap.cellSize;
      const cellBottom = cellTop + ExplorationMap.cellSize;
      const closestX = clamp(position.x, cellLeft, cellRight);
      const closestY = clamp(position.y, cellTop, cellBottom);
      const dx = position.x - closestX;
      const dy = position.y - closestY;
      if (dx * dx + dy * dy <= radius * radius) explored = true;
    });
    return explored;
  }

  forEachVisibleCell(center: Vec2, span: number, visitor: (position: Vec2) => void): void {
    const halfSpan = span / 2;
    this.forEachCoordinate({
      left: center.x - halfSpan,
      top: center.y - halfSpan,
      right: center.x + halfSpan,
      bottom: center.y + halfSpan,
    }, (column, row) => {
      if (!this.exploredRows.get(column)?.has(row)) return;
      visitor({ x: column * ExplorationMap.cellSize, y: row * ExplorationMap.cellSize });
    });
  }

  private forEachCoordinate(bounds: WorldBounds, visitor: (column: number, row: number) => void): void {
    const firstColumn = Math.floor(bounds.left / ExplorationMap.cellSize);
    const lastColumn = Math.floor(bounds.right / ExplorationMap.cellSize);
    const firstRow = Math.floor(bounds.top / ExplorationMap.cellSize);
    const lastRow = Math.floor(bounds.bottom / ExplorationMap.cellSize);
    for (let column = firstColumn; column <= lastColumn; column++) {
      for (let row = firstRow; row <= lastRow; row++) visitor(column, row);
    }
  }
}
