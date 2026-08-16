import type { Vec2 } from '../types';
import { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';

export abstract class SupplyContainer extends PhysicsBody {
  constructor(
    position: Vec2,
    public readonly amount: number,
  ) {
    super(position, { x: 0, y: 0 }, 13, 6, 0, 0);
  }

  abstract collect(ship: Ship): void;
}
