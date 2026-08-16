import type { Vec2 } from '../types';
import type { WorldBounds } from './Camera';

export class ExplorationMap {
  static readonly cellSize = 250;
  private readonly exploredRows = new Map<number, Set<number>>();

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
