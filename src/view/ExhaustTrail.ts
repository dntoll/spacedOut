import { add, random, scale } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';
import { ExhaustParticle } from './ExhaustParticle';

export class ExhaustTrail {
  private particles: ExhaustParticle[] = [];
  private emissionCarry = 0;

  update(dt: number, ship: Model.Ship): void {
    if (ship.isThrusting) this.emit(dt, ship);
    for (const particle of this.particles) particle.update(dt);
    this.particles = this.particles.filter((particle) => particle.isAlive);
  }

  draw(drawing: Drawing): void {
    drawing.withAdditiveBlend(() => {
      for (const particle of this.particles) {
        const life = particle.life / particle.maxLife;
        const color = life > 0.55
          ? `rgba(160,245,255,${life})`
          : `rgba(63,135,255,${life * 0.65})`;
        drawing.circle(particle.position, particle.size * life, color);
      }
    });
  }

  private emit(dt: number, ship: Model.Ship): void {
    const power = ship.thrustAmount;
    const forward = { x: Math.cos(ship.angle), y: Math.sin(ship.angle) };
    this.emissionCarry += dt * power * (28 + power * 46 + ship.speed * 0.06);
    while (this.emissionCarry >= 1) {
      this.emissionCarry--;
      this.particles.push(this.createParticle(ship, forward, power));
    }
  }

  private createParticle(ship: Model.Ship, forward: Vec2, power: number): ExhaustParticle {
    const side = { x: -forward.y, y: forward.x };
    const jitter = random(-1, 1);
    const life = random(0.35, 0.75);
    return new ExhaustParticle(
      add(ship.position, add(scale(forward, -15), scale(side, jitter * 5))),
      add(
        scale(ship.velocity, 0.18),
        add(scale(forward, random(-155, -85) * (0.55 + power * 0.65)), scale(side, jitter * 22)),
      ),
      life,
      life,
      random(1.5, 4),
    );
  }
}
