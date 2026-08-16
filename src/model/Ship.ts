import { add, clamp, length, scale, sub } from '../math';
import type { Vec2 } from '../types';
import { PhysicsBody } from './PhysicsBody';

export class Ship extends PhysicsBody {
  private aimTarget: Vec2 = { x: 0, y: -100 };
  private thrustPower = 0;

  constructor() {
    super({ x: 0, y: 0 }, { x: 0, y: 0 }, 18, 1.8, -Math.PI / 2, 0);
  }

  get speed(): number { return length(this.velocity); }
  get isThrusting(): boolean { return this.thrustPower > 0; }
  get thrustAmount(): number { return this.thrustPower; }

  aimAt(target: Vec2): void { this.aimTarget = { ...target }; }

  startThrust(): void {
    const distanceToTarget = length(sub(this.aimTarget, this.position));
    this.thrustPower = clamp((distanceToTarget - 18) / 360, 0, 1);
  }

  stopThrust(): void { this.thrustPower = 0; }

  applyControls(dt: number): void {
    const aim = sub(this.aimTarget, this.position);
    if (length(aim) > 3) this.angle = Math.atan2(aim.y, aim.x);
    if (!this.isThrusting) return;

    const forward = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    this.velocity = add(this.velocity, scale(forward, 170 * this.thrustPower * dt));
    if (this.speed > 650) this.velocity = scale(this.velocity, 650 / this.speed);
  }
}
