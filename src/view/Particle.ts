import { add, scale } from '../math';
import type { Vec2 } from '../types';

export class Particle {
  constructor(
    public position: Vec2,
    public velocity: Vec2,
    public readonly size: number,
    public burn: number,
    public readonly burnMax: number,
    public readonly hotColor: { r: number; g: number; b: number },
    public readonly hotAlpha: number,
  ) {}

  update(dt: number): void {
    this.position = add(this.position, scale(this.velocity, dt));
    this.burn = Math.max(0, this.burn - dt);
  }
}
