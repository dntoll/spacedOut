import type { Vec2 } from '../types';
import { PhysicsBody } from './PhysicsBody';

export interface AsteroidCavity {
  position: Vec2;
  radius: number;
}

export class MassiveAsteroid extends PhysicsBody {
  constructor(
    public readonly id: number,
    position: Vec2,
    radius: number,
    angle: number,
    public readonly vertices: number[],
    public readonly cavities: AsteroidCavity[],
    public readonly shade: number,
  ) {
    super(position, { x: 0, y: 0 }, radius, Number.POSITIVE_INFINITY, angle, 0);
  }
}
