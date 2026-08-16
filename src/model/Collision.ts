import type { Vec2 } from '../types';

export class Collision {
  constructor(
    public readonly position: Vec2,
    public readonly normal: Vec2,
    public readonly impactSpeed: number,
  ) {}
}
