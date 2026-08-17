import type { Vec2 } from '../types';
import { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';

const ATTRACTION_RANGE_RADII = 6;
const ATTRACTION_MAX_SPEED = 350;

export abstract class SupplyContainer extends PhysicsBody {
  constructor(
    position: Vec2,
    public readonly amount: number,
  ) {
    super(position, { x: 0, y: 0 }, 13, 6, 0, 0);
  }

  abstract collect(ship: Ship): void;

  attractToward(ship: Ship): void {
    const range = ship.radius * ATTRACTION_RANGE_RADII;
    const dx = this.position.x - ship.position.x;
    const dy = this.position.y - ship.position.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > range * range) return;
    const dist = Math.sqrt(distSq) || 1;
    const proximity = 1 - dist / range;
    const speed = ATTRACTION_MAX_SPEED * (0.3 + 0.7 * proximity);
    this.velocity.x = (-dx / dist) * speed;
    this.velocity.y = (-dy / dist) * speed;
  }
}
