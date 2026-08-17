import { add, scale } from '../math';
import type { Vec2 } from '../types';

export class Laser {
  public life: number;
  constructor(
    public position: Vec2,
    public velocity: Vec2,
    public angle: number,
    public readonly radius: number,
    life: number,
  ) {
    this.life = life;
  }

  get isAlive(): boolean { return this.life > 0; }

  update(dt: number): void {
    this.position = add(this.position, scale(this.velocity, dt));
    this.life -= dt;
  }
}
