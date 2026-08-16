import { add, scale } from '../math';
import type { Vec2 } from '../types';

export class PhysicsBody {
  constructor(
    public position: Vec2,
    public velocity: Vec2,
    public radius: number,
    public mass: number,
    public angle: number,
    public angularVelocity: number,
  ) {}

  integrate(dt: number): void {
    this.position = add(this.position, scale(this.velocity, dt));
    this.angle += this.angularVelocity * dt;
  }
}
