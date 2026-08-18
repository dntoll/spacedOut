import { add, dot, length, random, scale, sub } from '../math';
import type { Vec2 } from '../types';
import { BodyMass } from './BodyMass';
import { Laser } from './Laser';
import { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';

const PIRATE_RADIUS = 42;
const HUNT_ACCEL = 650;
const HUNT_MAX_SPEED = 1100;
const CLOSE_RANGE = 420;
const CLOSE_ACCEL_BOOST = 1.9;
const CLOSE_DAMP_RATE = 5.5;
const BASE_DAMP_RATE = 1;
const STANDOFF_RANGE = 560;
const STANDOFF_ACCEL_SCALE = 0.25;
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
    const dir = dist > 0.0001 ? scale(toShip, 1 / dist) : { x: 1, y: 0 };
    this.faceTarget(ship.position);

    const closeness = dist < CLOSE_RANGE ? 1 - dist / CLOSE_RANGE : 0;
    const accelMult = 1 + closeness * (CLOSE_ACCEL_BOOST - 1);
    const standoffScale = dist < STANDOFF_RANGE ? STANDOFF_ACCEL_SCALE : 1;
    this.velocity = add(this.velocity, scale(dir, HUNT_ACCEL * accelMult * standoffScale * dt));

    const along = Math.max(0, dot(this.velocity, dir));
    const across = sub(this.velocity, scale(dir, along));
    const dampRate = BASE_DAMP_RATE + closeness * CLOSE_DAMP_RATE;
    const dampFactor = Math.exp(-dampRate * dt);
    this.velocity = add(scale(dir, along), scale(across, dampFactor));

    const maxSpeed = HUNT_MAX_SPEED * (1 + closeness * 0.45);
    const speed = length(this.velocity);
    if (speed > maxSpeed) this.velocity = scale(this.velocity, maxSpeed / speed);
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
    const dist = length(sub(ship.position, this.position));
    if (dist > FIRE_RANGE) return null;
    if (this.fireTimer < FIRE_COOLDOWN) return null;
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
