import type { Vec2 } from '../types';
import { StationWall } from './StationWall';

export class StationGate extends StationWall {
  readonly index: number;
  open = false;

  constructor(index: number, position: Vec2, angle: number, halfLength: number, halfWidth: number) {
    super(position, angle, halfLength, halfWidth);
    this.index = index;
  }

  activate(): void { this.open = true; }
}
