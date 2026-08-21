import { clamp } from '../math';
import type { Vec2 } from '../types';
import { raySegmentT, type Segment } from './LineOfSight';

// Tracks world cells the ship has actually seen: within camera range AND with an
// unobstructed line of sight from the ship (blocked by station walls, closed
// gates, and massive asteroids per REQ-23/81). Seen cells accumulate as the ship
// explores and stay seen. This supersedes the camera-range-only ExplorationMap:
// nothing beyond a wall or massive asteroid is "seen" even when inside the
// camera rectangle, so the minimap shows only discovered parts of large bodies
// (massive asteroids, the station hull) and hides undiscovered interior detail.
const RAY_COUNT = 360;
const STEP_FRACTION = 0.5;

export class SeenMap {
  static readonly cellSize = 250;
  private readonly seenRows = new Map<number, Set<number>>();
  private lastKey = '';

  reset(): void {
    this.seenRows.clear();
    this.lastKey = '';
  }

  // Recast visibility rays from `origin` out to `radius` (the camera's visible
  // world radius), stopped early by `segments`. Recasts are throttled by the
  // ship's cell plus the caller-supplied `signature` (e.g. open-gate state) and
  // the rounded radius, so stationary frames do no work. `segments` must already
  // be culled to the reachable area (gatherOccluderSegments does this).
  update(origin: Vec2, radius: number, segments: Segment[], signature: string): void {
    const column = Math.floor(origin.x / SeenMap.cellSize);
    const row = Math.floor(origin.y / SeenMap.cellSize);
    const key = `${column}:${row}:${signature}:${radius.toFixed(0)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.cast(origin, radius, segments);
  }

  isSeen(position: Vec2, radius = 0): boolean {
    let seen = false;
    this.forEachCoordinate(
      {
        left: position.x - radius,
        top: position.y - radius,
        right: position.x + radius,
        bottom: position.y + radius,
      },
      (column, row) => {
        if (this.seenRows.get(column)?.has(row)) seen = true;
      },
    );
    return seen;
  }

  isCircleSeen(position: Vec2, radius: number): boolean {
    let seen = false;
    this.forEachCoordinate(
      {
        left: position.x - radius,
        top: position.y - radius,
        right: position.x + radius,
        bottom: position.y + radius,
      },
      (column, row) => {
        if (seen) return;
        if (!this.seenRows.get(column)?.has(row)) return;
        const cellLeft = column * SeenMap.cellSize;
        const cellRight = cellLeft + SeenMap.cellSize;
        const cellTop = row * SeenMap.cellSize;
        const cellBottom = cellTop + SeenMap.cellSize;
        const closestX = clamp(position.x, cellLeft, cellRight);
        const closestY = clamp(position.y, cellTop, cellBottom);
        const dx = position.x - closestX;
        const dy = position.y - closestY;
        if (dx * dx + dy * dy <= radius * radius) seen = true;
      },
    );
    return seen;
  }

  forEachSeenCellInBox(center: Vec2, span: number, visitor: (position: Vec2) => void): void {
    const halfSpan = span / 2;
    this.forEachCoordinate(
      {
        left: center.x - halfSpan,
        top: center.y - halfSpan,
        right: center.x + halfSpan,
        bottom: center.y + halfSpan,
      },
      (column, row) => {
        if (!this.seenRows.get(column)?.has(row)) return;
        visitor({ x: column * SeenMap.cellSize, y: row * SeenMap.cellSize });
      },
    );
  }

  private cast(origin: Vec2, radius: number, segments: Segment[]): void {
    const step = SeenMap.cellSize * STEP_FRACTION;
    for (let i = 0; i < RAY_COUNT; i++) {
      const a = (i / RAY_COUNT) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let bestT = radius;
      for (const s of segments) {
        const t = raySegmentT(origin.x, origin.y, dx, dy, s);
        if (t !== null && t < bestT) bestT = t;
      }
      this.markRay(origin, dx, dy, bestT, step);
    }
  }

  private markRay(origin: Vec2, dx: number, dy: number, dist: number, step: number): void {
    let d = 0;
    while (d <= dist) {
      this.markCell(origin.x + dx * d, origin.y + dy * d);
      if (d === dist) break;
      d = Math.min(d + step, dist);
    }
  }

  private markCell(x: number, y: number): void {
    const c = this.cellKey(x, y);
    let rows = this.seenRows.get(c.column);
    if (!rows) {
      rows = new Set<number>();
      this.seenRows.set(c.column, rows);
    }
    rows.add(c.row);
  }

  private cellKey(x: number, y: number): { column: number; row: number } {
    return { column: Math.floor(x / SeenMap.cellSize), row: Math.floor(y / SeenMap.cellSize) };
  }

  private forEachCoordinate(
    bounds: { left: number; top: number; right: number; bottom: number },
    visitor: (column: number, row: number) => void,
  ): void {
    const firstColumn = Math.floor(bounds.left / SeenMap.cellSize);
    const lastColumn = Math.floor(bounds.right / SeenMap.cellSize);
    const firstRow = Math.floor(bounds.top / SeenMap.cellSize);
    const lastRow = Math.floor(bounds.bottom / SeenMap.cellSize);
    for (let column = firstColumn; column <= lastColumn; column++) {
      for (let row = firstRow; row <= lastRow; row++) visitor(column, row);
    }
  }
}
