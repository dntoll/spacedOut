import type { Vec2 } from '../types';
import { StationObstacle } from './StationObstacle';
import { rectangleVertices } from './StationGeometry';

export class StationWall extends StationObstacle {
  readonly halfLength: number;
  readonly halfWidth: number;
  readonly vertices: number[];

  constructor(position: Vec2, angle: number, halfLength: number, halfWidth: number) {
    super(position, halfLength, angle);
    this.halfLength = halfLength;
    this.halfWidth = halfWidth;
    this.vertices = rectangleVertices(halfLength, halfWidth, 18);
  }
}
