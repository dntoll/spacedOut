import type { Vec2 } from '../types';

export class Damage {
  constructor(
    public readonly position: Vec2,
    public readonly amount: number,
    public readonly lethal: boolean,
  ) {}
}
