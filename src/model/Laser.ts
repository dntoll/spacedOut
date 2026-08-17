import { add, scale } from '../math';
import type { Vec2 } from '../types';

export class Laser {
  constructor(
    public position: Vec2,
    public velocity: Vec2,
    public angle: number,
    public readonly radius: number,
  ) {}

  update(dt: number): void {
    this.position = add(this.position, scale(this.velocity, dt));
  }
}
