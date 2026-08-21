import type { Vec2 } from '../types';
import { StationObstacle } from './StationObstacle';

// A rectangular wall represented as a single open two-vertex chain (a capsule)
// so the swept test treats it as one continuous edge. Station gates build on
// this; the halfLength/halfWidth fields remain for the fixture renderer.
export class StationWall extends StationObstacle {
  readonly halfLength: number;
  readonly halfWidth: number;
  readonly localVertices: Vec2[];
  readonly closed = false;
  readonly wallRadius: number;

  constructor(position: Vec2, angle: number, halfLength: number, halfWidth: number) {
    super(position, halfLength + halfWidth, angle);
    this.halfLength = halfLength;
    this.halfWidth = halfWidth;
    this.wallRadius = halfWidth;
    this.localVertices = [{ x: -halfLength, y: 0 }, { x: halfLength, y: 0 }];
  }
}
