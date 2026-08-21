import { add, length, scale, sub } from '../math';
import type { Vec2 } from '../types';
import { BodyMass } from './BodyMass';
import { ICE_RING_INNER_RADIUS, ICE_RING_OUTER_RADIUS } from './IceRing';
import { PhysicsBody } from './PhysicsBody';
import type { Star } from './Star';

export const FREIGHTER_RADIUS = 120;
const ORBIT = (ICE_RING_INNER_RADIUS + ICE_RING_OUTER_RADIUS) / 2;
const ORBIT_SPEED = 0.045;

export class Freighter extends PhysicsBody {
  private placed = false;
  private orbitalAngle = 0;
  private orbitRadius = ORBIT;

  constructor() {
    super(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      FREIGHTER_RADIUS,
      BodyMass.fromRadius(FREIGHTER_RADIUS, 0.008),
      0,
      0,
    );
  }

  get isPlaced(): boolean { return this.placed; }
  get vertices(): number[] { return [1, 0.72, 0.9, 0.55, 0.88, 0.7]; }

  placeAround(star: Star, angle = 0): void {
    if (!star.isPlaced) return;
    this.orbitRadius = ORBIT;
    this.orbitalAngle = angle;
    this.placed = true;
    this.snapToOrbit(star.position);
  }

  clear(): void { this.placed = false; }

  update(dt: number, star: Star): void {
    if (!this.placed || !star.isPlaced) return;
    this.previousPosition = { ...this.position };
    this.orbitalAngle += ORBIT_SPEED * dt;
    this.snapToOrbit(star.position);
  }

  reachedBy(shipPosition: Vec2, shipRadius: number): boolean {
    if (!this.placed) return false;
    return length(sub(this.position, shipPosition)) <= this.radius + shipRadius;
  }

  private snapToOrbit(center: Vec2): void {
    const c = Math.cos(this.orbitalAngle);
    const s = Math.sin(this.orbitalAngle);
    this.position = add(center, scale({ x: c, y: s }, this.orbitRadius));
    const tangential = ORBIT_SPEED * this.orbitRadius;
    this.velocity = { x: -s * tangential, y: c * tangential };
    this.angle = this.orbitalAngle + Math.PI / 2;
  }
}
