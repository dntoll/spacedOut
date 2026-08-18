import { add, length, normalize, scale, sub } from '../math';
import type { Vec2 } from '../types';

const PUSH_RANGE = 420;
const PUSH_FORCE = 1600;
const SPRING = 0.9;
const DAMP = 1.8;

export interface NebulaColor { r: number; g: number; b: number }

export class NebulaParticle {
  private velocity: Vec2 = { x: 0, y: 0 };

  constructor(
    public position: Vec2,
    private readonly home: Vec2,
    public readonly size: number,
    public readonly color: NebulaColor,
    public readonly alpha: number,
  ) {}

  update(dt: number, shipPosition: Vec2): void {
    let accel: Vec2 = { x: 0, y: 0 };
    const toShip = sub(this.position, shipPosition);
    const dist = length(toShip);
    if (dist < PUSH_RANGE && dist > 0.0001) {
      const pushDir = scale(toShip, 1 / dist);
      const strength = (1 - dist / PUSH_RANGE) * PUSH_FORCE;
      accel = add(accel, scale(pushDir, strength));
    }
    accel = add(accel, scale(sub(this.home, this.position), SPRING));
    this.velocity = add(this.velocity, scale(accel, dt));
    this.velocity = scale(this.velocity, Math.exp(-DAMP * dt));
    this.position = add(this.position, scale(this.velocity, dt));
  }
}
