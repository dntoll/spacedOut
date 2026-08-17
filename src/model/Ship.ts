import { add, clamp, dot, length, scale, sub } from '../math';
import type { ControlTuning, Vec2 } from '../types';
import { BodyMass } from './BodyMass';
import { PhysicsBody } from './PhysicsBody';

export class Ship extends PhysicsBody {
  private aimTarget: Vec2 = { x: 0, y: -100 };
  private throttle = 0;
  private airLevel = 100;
  private fuelLevel = 100;
  private dampening = 1.5;
  private thrustAccel = 170;
  private maxSpeed = 650;

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
  get isThrusting(): boolean { return this.throttle > 0; }
  get thrustAmount(): number { return this.throttle; }
  get air(): number { return this.airLevel; }
  get fuel(): number { return this.fuelLevel; }

  aimAt(target: Vec2): void { this.aimTarget = { ...target }; }

  setControlTuning(tuning: ControlTuning): void {
    this.dampening = Math.max(0, tuning.dampening);
    this.thrustAccel = Math.max(0, tuning.thrustAccel);
    this.maxSpeed = Math.max(0, tuning.maxSpeed);
  }

  startThrust(): void {
    if (this.fuelLevel <= 0) {
      this.throttle = 0;
      return;
    }
    const distanceToTarget = length(sub(this.aimTarget, this.position));
    this.throttle = clamp((distanceToTarget - 18) / 360, 0, 1);
  }

  stopThrust(): void { this.throttle = 0; }
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
    const forwardSpeed = Math.max(0, dot(this.velocity, forward));
    const nonForward = sub(this.velocity, scale(forward, forwardSpeed));
    const dampFactor = Math.exp(-this.dampening * dt);
    this.velocity = add(scale(forward, forwardSpeed), scale(nonForward, dampFactor));

    this.velocity = add(this.velocity, scale(forward, this.thrustAccel * this.throttle * dt));
    this.fuelLevel = Math.max(0, this.fuelLevel - 5 * this.throttle * dt);
    if (this.fuelLevel <= 0) this.throttle = 0;
    if (this.speed > this.maxSpeed) this.velocity = scale(this.velocity, this.maxSpeed / this.speed);
  }
}
