import { add, scale } from '../math';
import type { Vec2 } from '../types';

export class CollisionParticle {
  constructor(
    public position: Vec2,
    private readonly velocity: Vec2,
    public life: number,
    public readonly maxLife: number,
    public readonly size: number,
    public readonly heat: number,
  ) {}

  get isAlive(): boolean { return this.life > 0; }

  update(dt: number): void {
    this.position = add(this.position, scale(this.velocity, dt));
    this.life -= dt;
  }
}
