import type { Vec2 } from '../types';

export const NEBULA_PUSH_RANGE = 420;
const PUSH_FORCE = 1600;
const SPRING = 0.9;
const DAMP = 1.8;
const SETTLED_DISTANCE_SQUARED = 0.01;
const SETTLED_SPEED_SQUARED = 0.01;

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

  get isSettled(): boolean {
    return this.position.x === this.home.x && this.position.y === this.home.y
      && this.velocity.x === 0 && this.velocity.y === 0;
  }

  update(dt: number, pushers: Vec2[]): void {
    let accelX = (this.home.x - this.position.x) * SPRING;
    let accelY = (this.home.y - this.position.y) * SPRING;
    const pushRangeSquared = NEBULA_PUSH_RANGE * NEBULA_PUSH_RANGE;
    for (const pusher of pushers) {
      const dx = this.position.x - pusher.x;
      const dy = this.position.y - pusher.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < pushRangeSquared && distanceSquared > 0.00000001) {
        const distance = Math.sqrt(distanceSquared);
        const strength = (1 - distance / NEBULA_PUSH_RANGE) * PUSH_FORCE / distance;
        accelX += dx * strength;
        accelY += dy * strength;
      }
    }
    const damping = Math.exp(-DAMP * dt);
    this.velocity.x = (this.velocity.x + accelX * dt) * damping;
    this.velocity.y = (this.velocity.y + accelY * dt) * damping;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    if (pushers.length === 0) {
      const homeX = this.home.x - this.position.x;
      const homeY = this.home.y - this.position.y;
      const speedSquared = this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y;
      if (homeX * homeX + homeY * homeY < SETTLED_DISTANCE_SQUARED && speedSquared < SETTLED_SPEED_SQUARED) {
        this.position.x = this.home.x;
        this.position.y = this.home.y;
        this.velocity.x = 0;
        this.velocity.y = 0;
      }
    }
  }
}
