import { add, dot, length, random, scale, sub } from '../math';
import type { Vec2 } from '../types';
import { BodyMass } from './BodyMass';
import { MassiveAsteroid } from './MassiveAsteroid';
import type { MassiveAsteroidField } from './MassiveAsteroidField';
import { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';

const DRONE_RADIUS = 18;
const HUNT_ACCEL = 190;
const HUNT_MAX_SPEED = 300;
const CLOSE_RANGE = 260;
const CLOSE_ACCEL_BOOST = 1.9;
const CLOSE_DAMP_RATE = 5.5;
const BASE_DAMP_RATE = 1;
const REHOME_ACCEL = 200;
const REHOME_MAX_SPEED = 320;
const REHOME_ATTACH_DISTANCE = 4;

export class Drone extends PhysicsBody {
  public hp: number;
  public killed = false;
  public reHomeTarget: PhysicsBody | null = null;

  constructor(
    public host: PhysicsBody | null,
    public gripAngle: number,
    public readonly vertices: number[],
    hp: number,
  ) {
    const origin = host ? host.position : { x: 0, y: 0 };
    super(
      { ...origin },
      { x: 0, y: 0 },
      DRONE_RADIUS,
      BodyMass.fromRadius(DRONE_RADIUS, 0.011),
      gripAngle + Math.PI,
      0,
    );
    this.hp = hp;
  }

  get isHunting(): boolean { return this.host === null && this.reHomeTarget === null; }
  get isReHoming(): boolean { return this.reHomeTarget !== null; }

  detach(): void { this.host = null; }

  startReHoming(target: PhysicsBody): void {
    this.host = null;
    this.reHomeTarget = target;
  }

  private attachTo(target: PhysicsBody): void {
    this.host = target;
    this.reHomeTarget = null;
    this.gripAngle = Math.atan2(
      this.position.y - target.position.y,
      this.position.x - target.position.x,
    );
  }

  reHome(dt: number, target: PhysicsBody, massiveField: MassiveAsteroidField | null): void {
    const toTarget = sub(target.position, this.position);
    const dist = length(toTarget);
    if (dist <= target.radius + this.radius + REHOME_ATTACH_DISTANCE) {
      this.attachTo(target);
      this.rideHost(massiveField);
      return;
    }
    const dir = dist > 0.0001 ? scale(toTarget, 1 / dist) : { x: 1, y: 0 };
    this.faceTarget(target.position);
    this.velocity = add(this.velocity, scale(dir, REHOME_ACCEL * dt));
    const along = Math.max(0, dot(this.velocity, dir));
    const across = sub(this.velocity, scale(dir, along));
    const dampFactor = Math.exp(-BASE_DAMP_RATE * dt);
    this.velocity = add(scale(dir, along), scale(across, dampFactor));
    const speed = length(this.velocity);
    if (speed > REHOME_MAX_SPEED) this.velocity = scale(this.velocity, REHOME_MAX_SPEED / speed);
    this.integrate(dt);
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

  rideHost(massiveField: MassiveAsteroidField | null): void {
    if (!this.host) return;
    const dir: Vec2 = { x: Math.cos(this.gripAngle), y: Math.sin(this.gripAngle) };
    let surfaceRadius = this.host.radius;
    if (massiveField && this.host instanceof MassiveAsteroid) {
      surfaceRadius = massiveField.boundaryRadiusAt(this.host, add(this.host.position, scale(dir, this.host.radius)));
    }
    const offset = surfaceRadius + this.radius * 0.4;
    this.position = add(this.host.position, scale(dir, offset));
    this.previousPosition = { ...this.position };
    this.angle = this.gripAngle + Math.PI;
    this.velocity = { ...this.host.velocity };
  }

  faceTarget(target: Vec2): void {
    this.angle = Math.atan2(target.y - this.position.y, target.x - this.position.x);
  }

  hunt(dt: number, ship: Ship): void {
    const toShip = sub(ship.position, this.position);
    const dist = length(toShip);
    const dir = dist > 0.0001 ? scale(toShip, 1 / dist) : { x: 1, y: 0 };
    this.faceTarget(ship.position);

    const closeness = dist < CLOSE_RANGE ? 1 - dist / CLOSE_RANGE : 0;
    const accelMult = 1 + closeness * (CLOSE_ACCEL_BOOST - 1);
    this.velocity = add(this.velocity, scale(dir, HUNT_ACCEL * accelMult * dt));

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

  static createBodyVertices(): number[] {
    const count = Math.floor(random(5, 9));
    return Array.from({ length: count }, () => random(0.7, 1.15));
  }
}
