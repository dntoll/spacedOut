import type { Vec2 } from '../types';
import type { WorldBounds } from './Camera';
import type { Drawing, RadialPaint } from './Drawing';
import { NEBULA_PUSH_RANGE, NebulaParticle } from './NebulaParticle';

export class NebulaCloud {
  private bounds: WorldBounds;
  private settled = true;

  constructor(private readonly particles: NebulaParticle[]) {
    this.bounds = this.calculateBounds();
  }

  update(dt: number, pushers: Vec2[]): void {
    const nearbyPushers = pushers.filter((pusher) => this.containsPusher(pusher));
    if (nearbyPushers.length === 0 && this.settled) return;

    for (const particle of this.particles) particle.update(dt, nearbyPushers);
    this.settled = this.particles.every((particle) => particle.isSettled);
    this.bounds = this.calculateBounds();
  }

  draw(drawing: Drawing, visibleBounds?: WorldBounds): void {
    if (visibleBounds && !this.intersects(visibleBounds)) return;
    for (const particle of this.particles) {
      if (visibleBounds && !this.particleIntersects(particle, visibleBounds)) continue;
      const { r, g, b } = particle.color;
      const paint: RadialPaint = {
        from: { x: particle.position.x, y: particle.position.y }, fromRadius: 0,
        to: { x: particle.position.x, y: particle.position.y }, toRadius: particle.size,
        stops: [
          { offset: 0, color: `rgba(${r},${g},${b},${particle.alpha})` },
          { offset: 0.6, color: `rgba(${r},${g},${b},${particle.alpha * 0.35})` },
          { offset: 1, color: `rgba(${r},${g},${b},0)` },
        ],
      };
      drawing.circle(particle.position, particle.size, paint);
    }
  }

  isWithin(position: Vec2, radius: number): boolean {
    const nearestX = Math.max(this.bounds.left, Math.min(position.x, this.bounds.right));
    const nearestY = Math.max(this.bounds.top, Math.min(position.y, this.bounds.bottom));
    const dx = nearestX - position.x;
    const dy = nearestY - position.y;
    return dx * dx + dy * dy <= radius * radius;
  }

  private containsPusher(pusher: Vec2): boolean {
    return pusher.x >= this.bounds.left - NEBULA_PUSH_RANGE
      && pusher.x <= this.bounds.right + NEBULA_PUSH_RANGE
      && pusher.y >= this.bounds.top - NEBULA_PUSH_RANGE
      && pusher.y <= this.bounds.bottom + NEBULA_PUSH_RANGE;
  }

  private intersects(other: WorldBounds): boolean {
    return this.bounds.right >= other.left && this.bounds.left <= other.right
      && this.bounds.bottom >= other.top && this.bounds.top <= other.bottom;
  }

  private particleIntersects(particle: NebulaParticle, bounds: WorldBounds): boolean {
    return particle.position.x + particle.size >= bounds.left
      && particle.position.x - particle.size <= bounds.right
      && particle.position.y + particle.size >= bounds.top
      && particle.position.y - particle.size <= bounds.bottom;
  }

  private calculateBounds(): WorldBounds {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const particle of this.particles) {
      left = Math.min(left, particle.position.x - particle.size);
      top = Math.min(top, particle.position.y - particle.size);
      right = Math.max(right, particle.position.x + particle.size);
      bottom = Math.max(bottom, particle.position.y + particle.size);
    }
    return { left, top, right, bottom };
  }
}
