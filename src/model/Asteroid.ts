import type { Vec2 } from '../types';
import { PhysicsBody } from './PhysicsBody';

export class Asteroid extends PhysicsBody {
  constructor(
    public readonly id: number,
    position: Vec2,
    velocity: Vec2,
    radius: number,
    angle: number,
    angularVelocity: number,
    public readonly vertices: number[],
    public readonly shade: number,
  ) {
    super(position, velocity, radius, radius * radius * 0.012, angle, angularVelocity);
  }
}
