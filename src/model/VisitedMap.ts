import type { Vec2 } from '../types';

export class VisitedMap {
  static readonly cellSize = 1000;
  private readonly cells = new Set<string>();

  visit(position: Vec2): void {
    this.cells.add(this.key(position));
  }

  has(position: Vec2): boolean {
    return this.cells.has(this.key(position));
  }

  snapshot(): Set<string> {
    return new Set(this.cells);
  }

  contains(charted: ReadonlySet<string>, position: Vec2): boolean {
    return charted.has(this.key(position));
  }

  private key(position: Vec2): string {
    const column = Math.floor(position.x / VisitedMap.cellSize);
    const row = Math.floor(position.y / VisitedMap.cellSize);
    return `${column},${row}`;
  }
}
