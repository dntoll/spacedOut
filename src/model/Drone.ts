import { add, dot, length, random, scale, sub } from '../math';
import type { Vec2 } from '../types';
import { BodyMass } from './BodyMass';
import { MassiveAsteroid } from './MassiveAsteroid';
import type { MassiveAsteroidField } from './MassiveAsteroidField';
import { PhysicsBody } from './PhysicsBody';
import type { Ship } from './Ship';

const DRONE_RADIUS = 18;
const HUNT_ACCEL = 220;
const HUNT_MAX_SPEED = 340;
const CLOSE_RANGE = 260;
const CLOSE_ACCEL_BOOST = 1.9;
const CLOSE_DAMP_RATE = 5.5;
const BASE_DAMP_RATE = 1;

export class Drone extends PhysicsBody {
  public hp: number;
  public killed = false;

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

  get isHunting(): boolean { return this.host === null; }

  detach(): void { this.host = null; }

  takeLaserHit(): boolean {
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
