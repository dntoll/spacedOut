import { add, clamp, length, scale, sub } from '../math';
import type { Vec2 } from '../types';
import { BodyMass } from './BodyMass';
import { PhysicsBody } from './PhysicsBody';

export class Ship extends PhysicsBody {
  private aimTarget: Vec2 = { x: 0, y: -100 };
  private thrustPower = 0;
  private airLevel = 100;
  private fuelLevel = 100;

  constructor() {
    const radius = 18;
    super(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      radius,
      BodyMass.fromRadius(radius, 0.011),
      -Math.PI / 2,
      0,
    );
  }

  get speed(): number { return length(this.velocity); }
  get isThrusting(): boolean { return this.thrustPower > 0; }
  get thrustAmount(): number { return this.thrustPower; }
  get air(): number { return this.airLevel; }
  get fuel(): number { return this.fuelLevel; }

  aimAt(target: Vec2): void { this.aimTarget = { ...target }; }

  startThrust(): void {
    if (this.fuelLevel <= 0) {
      this.thrustPower = 0;
      return;
    }
    const distanceToTarget = length(sub(this.aimTarget, this.position));
    this.thrustPower = clamp((distanceToTarget - 18) / 360, 0, 1);
  }

  stopThrust(): void { this.thrustPower = 0; }
  collectAir(amount: number): void { this.airLevel = clamp(this.airLevel + amount, 0, 100); }
  collectFuel(amount: number): void { this.fuelLevel = clamp(this.fuelLevel + amount, 0, 100); }

  updateLifeSupport(dt: number): void {
    this.airLevel = Math.max(0, this.airLevel - dt * 0.7);
  }

  applyControls(dt: number): void {
    const aim = sub(this.aimTarget, this.position);
    if (length(aim) > 3) this.angle = Math.atan2(aim.y, aim.x);
    if (!this.isThrusting) return;

    const forward = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    this.velocity = add(this.velocity, scale(forward, 170 * this.thrustPower * dt));
    this.fuelLevel = Math.max(0, this.fuelLevel - 5 * this.thrustPower * dt);
    if (this.fuelLevel <= 0) this.thrustPower = 0;
    if (this.speed > 650) this.velocity = scale(this.velocity, 650 / this.speed);
  }
}
