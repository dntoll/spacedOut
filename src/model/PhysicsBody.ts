import { add, scale } from '../math';
import type { Vec2 } from '../types';

export class PhysicsBody {
  public previousPosition: Vec2;

  constructor(
    public position: Vec2,
    public velocity: Vec2,
    public radius: number,
    public mass: number,
    public angle: number,
    public angularVelocity: number,
    public readonly massive = false,
  ) {
    this.previousPosition = { ...position };
  }

  integrate(dt: number): void {
    this.previousPosition = { ...this.position };
    this.position = add(this.position, scale(this.velocity, dt));
    this.angle += this.angularVelocity * dt;
  }
}
