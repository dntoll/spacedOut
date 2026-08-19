import type { Vec2 } from '../types';
import { StationObstacle } from './StationObstacle';
import { rectangleVertices } from './StationGeometry';

export class StationMachinery extends StationObstacle {
  readonly vertices: number[];
  readonly variant: number;

  constructor(position: Vec2, radius: number, angle: number, variant: number) {
    super(position, radius, angle);
    this.vertices = rectangleVertices(radius, radius * 0.72, 18);
    this.variant = variant;
  }
}
