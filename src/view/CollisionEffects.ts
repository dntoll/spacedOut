import { random, scale } from '../math';
import type * as Model from '../model';
import { CollisionParticle } from './CollisionParticle';

export class CollisionEffects {
  private particles: CollisionParticle[] = [];

  emit(collision: Model.Collision): void {
    const count = Math.min(28, Math.max(4, Math.round(collision.impactSpeed * 0.12)));
    const normalAngle = Math.atan2(collision.normal.y, collision.normal.x);
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const angle = normalAngle + (side < 0 ? Math.PI : 0) + random(-1.15, 1.15);
      const speed = random(22, 75 + collision.impactSpeed * 0.65);
      const life = random(0.18, 0.58);
      this.particles.push(new CollisionParticle(
        { ...collision.position },
        scale({ x: Math.cos(angle), y: Math.sin(angle) }, speed),
        life,
        life,
        random(1, 3.4),
        random(0.55, 1),
      ));
    }
  }

  update(dt: number): void {
    for (const particle of this.particles) particle.update(dt);
    this.particles = this.particles.filter((particle) => particle.isAlive);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of this.particles) {
      const life = particle.life / particle.maxLife;
      ctx.beginPath();
      ctx.fillStyle = particle.heat > 0.78
        ? `rgba(220,250,255,${life})`
        : `rgba(70,180,255,${life * 0.8})`;
      ctx.arc(particle.position.x, particle.position.y, particle.size * life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
