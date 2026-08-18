import { add, clamp, dot, length, random, scale, sub } from '../math';
import type { Vec2 } from '../types';
import { BodyMass } from './BodyMass';
import { Laser } from './Laser';
import { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';

const PIRATE_RADIUS = 42;
const HUNT_ACCEL = 650;
const HUNT_MAX_SPEED = 1100;
const BASE_DAMP_RATE = 1;
const TURN_RATE = 2.2;
const PASS_RANGE = 600;
const PASS_OFFSET = 400;
const AVOID_RANGE = 220;
const AVOID_ACCEL_BOOST = 1.6;
const AIM_CONE_HALF_ANGLE = 35 * Math.PI / 180;
const FIRE_COOLDOWN = 0.8;
const FIRE_RANGE = 1200;
const LASER_SPEED = 1400;
const LASER_RADIUS = 3;
const NOSE_OFFSET = 38;

export class Pirate extends PhysicsBody {
  public hp: number;
  public killed = false;
  public awake = false;
  private fireCooldown = 0;
  private fireTimer = 0;

  constructor(
    position: Vec2,
    public readonly vertices: number[],
    hp: number,
    public readonly squadId: number = -1,
    public readonly peripheral: boolean = false,
  ) {
    super(
      { ...position },
      { x: 0, y: 0 },
      PIRATE_RADIUS,
      BodyMass.fromRadius(PIRATE_RADIUS, 0.011),
      0,
      0,
    );
    this.hp = hp;
  }

  get isHunting(): boolean { return this.awake; }
  get radiusValue(): number { return PIRATE_RADIUS; }

  awaken(): void { this.awake = true; }

  faceTarget(target: Vec2): void {
    this.angle = Math.atan2(target.y - this.position.y, target.x - this.position.x);
  }

  takeLaserHit(): boolean {
    this.hp -= 1;
    if (this.hp <= 0) this.killed = true;
    return this.killed;
  }

  takeImpact(): boolean {
    this.hp -= 1;
    if (this.hp <= 0) this.killed = true;
    return this.killed;
  }

  hunt(dt: number, ship: Ship): void {
    const toShip = sub(ship.position, this.position);
    const dist = length(toShip);
    const dirToShip = dist > 0.0001 ? scale(toShip, 1 / dist) : { x: 1, y: 0 };
    const forward = { x: Math.cos(this.angle), y: Math.sin(this.angle) };

    let target: Vec2;
    let accelMult = 1;
    if (dist < AVOID_RANGE) {
      target = add(this.position, scale(dirToShip, -1));
      accelMult = AVOID_ACCEL_BOOST;
    } else if (dist < PASS_RANGE) {
      const cross = forward.x * dirToShip.y - forward.y * dirToShip.x;
      const side = cross >= 0 ? 1 : -1;
      const perp = { x: -dirToShip.y, y: dirToShip.x };
      target = add(this.position, scale(perp, side * PASS_OFFSET));
    } else {
      target = ship.position;
    }

    const desiredAngle = Math.atan2(target.y - this.position.y, target.x - this.position.x);
    let diff = desiredAngle - this.angle;
    diff = ((diff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    this.angle += clamp(diff, -TURN_RATE * dt, TURN_RATE * dt);

    const noseForward = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    this.velocity = add(this.velocity, scale(noseForward, HUNT_ACCEL * accelMult * dt));

    const along = Math.max(0, dot(this.velocity, noseForward));
    const across = sub(this.velocity, scale(noseForward, along));
    const dampFactor = Math.exp(-BASE_DAMP_RATE * dt);
    this.velocity = add(scale(noseForward, along), scale(across, dampFactor));

    const speed = length(this.velocity);
    if (speed > HUNT_MAX_SPEED) this.velocity = scale(this.velocity, HUNT_MAX_SPEED / speed);
    this.integrate(dt);
  }

  drift(dt: number): void {
    const dampFactor = Math.exp(-BASE_DAMP_RATE * dt);
    this.velocity = scale(this.velocity, dampFactor);
    this.integrate(dt);
  }

  tryFire(dt: number, ship: Ship): Laser | null {
    this.fireTimer += dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.fireCooldown > 0) return null;
    const toShip = sub(ship.position, this.position);
    const dist = length(toShip);
    if (dist > FIRE_RANGE) return null;
    if (this.fireTimer < FIRE_COOLDOWN) return null;
    const angleToShip = Math.atan2(toShip.y, toShip.x);
    let aimDiff = angleToShip - this.angle;
    aimDiff = ((aimDiff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (aimDiff > Math.PI) aimDiff -= Math.PI * 2;
    if (Math.abs(aimDiff) > AIM_CONE_HALF_ANGLE) return null;
    this.fireTimer = 0;
    this.fireCooldown = FIRE_COOLDOWN;
    const forward = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    const muzzle = add(this.position, scale(forward, NOSE_OFFSET));
    const velocity = add(scale(forward, LASER_SPEED), this.velocity);
    return new Laser(muzzle, velocity, this.angle, LASER_RADIUS, this);
  }

  static createBodyVertices(): number[] {
    const count = Math.floor(random(6, 10));
    return Array.from({ length: count }, () => random(0.7, 1.15));
  }
}

export const PIRATE_LASER_DAMAGE = 15;
export { PIRATE_RADIUS };
