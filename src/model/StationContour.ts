import type { Vec2 } from '../types';
import { StationObstacle } from './StationObstacle';

// A station wall built from traced bitmap contours (or the hull arc): an explicit
// polyline of local-space vertices with a wall thickness, positioned at the
// station center and rotated by the entrance angle. `closed` loops enclose rooms;
// open chains form the hull ring (with the entrance gap) and the entrance opening.
export class StationContour extends StationObstacle {
  readonly localVertices: Vec2[];
  readonly closed: boolean;
  readonly wallRadius: number;

  constructor(position: Vec2, angle: number, localVertices: Vec2[], closed: boolean, wallRadius: number) {
    const radius = localVertices.reduce((m, v) => Math.max(m, Math.hypot(v.x, v.y)), 0);
    super(position, radius, angle);
    this.localVertices = localVertices;
    this.closed = closed;
    this.wallRadius = wallRadius;
  }
}
