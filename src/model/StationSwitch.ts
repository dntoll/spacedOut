import type { Vec2 } from '../types';

export class StationSwitch {
  readonly index: number;
  readonly position: Vec2;
  readonly radius: number;
  activated = false;

  constructor(index: number, position: Vec2, radius: number) {
    this.index = index;
    this.position = { ...position };
    this.radius = radius;
  }

  activate(): void { this.activated = true; }
}
