import { add, length, random, scale, sub } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing, Size } from './Drawing';
import { ExhaustParticle } from './ExhaustParticle';

const CULL_MARGIN = 60;
const FUEL_COLOR = { r: 255, g: 195, b: 92 };
const DUST_COLOR = { r: 120, g: 200, b: 235 };
const HOT_ALPHA = 0.9;
const COOL_ALPHA = 0.6;

export class ExhaustTrail {
  private particles: ExhaustParticle[] = [];
  private emissionCarry = 0;
  private visibility = 1;

  constructor(private readonly onParticleExpire?: (position: Vec2, velocity: Vec2) => void) {}

  setVisibility(v: number): void { this.visibility = Math.max(0, v); }
  reset(): void { this.particles = []; this.emissionCarry = 0; }

  update(dt: number, ship: Model.Ship, camera: Camera, viewport: Size): void {
    if (ship.isThrusting && ship.isAlive) this.emit(dt, ship);
    for (const particle of this.particles) particle.update(dt);
    const maxDist = camera.getVisibleWorldRadius(viewport) + CULL_MARGIN;
    const center = camera.worldPosition;
    const survivors: ExhaustParticle[] = [];
    for (const particle of this.particles) {
      if (!particle.isAlive) { this.onParticleExpire?.(particle.position, particle.velocity); continue; }
      if (length(sub(particle.position, center)) > maxDist) continue;
      survivors.push(particle);
    }
    this.particles = survivors;
  }

  draw(drawing: Drawing): void {
    drawing.withAdditiveBlend(() => {
      for (const particle of this.particles) {
        const t = particle.life / particle.maxLife;
        const r = Math.round(DUST_COLOR.r + (FUEL_COLOR.r - DUST_COLOR.r) * t);
        const g = Math.round(DUST_COLOR.g + (FUEL_COLOR.g - DUST_COLOR.g) * t);
        const b = Math.round(DUST_COLOR.b + (FUEL_COLOR.b - DUST_COLOR.b) * t);
        const a = (COOL_ALPHA + (HOT_ALPHA - COOL_ALPHA) * t) * this.visibility;
        drawing.circle(particle.position, particle.size * (0.5 + 0.5 * t), `rgba(${r},${g},${b},${a})`);
      }
    });
  }

  private emit(dt: number, ship: Model.Ship): void {
    const forward = { x: Math.cos(ship.angle), y: Math.sin(ship.angle) };
    const dir = ship.directionalThrust;
    const dirVec = dir?.vec ?? { x: 0, y: 0 };
    const level = dir?.level ?? 0;
    const nozzles = [
      { offset: { x: -15, y: 0 }, emit: { x: -1, y: 0 }, power: ship.pointerThrust + Math.max(0, dirVec.x) * level },
      { offset: { x: 20, y: 0 }, emit: { x: 1, y: 0 }, power: Math.max(0, -dirVec.x) * level },
      { offset: { x: -4, y: -13 }, emit: { x: 0, y: -1 }, power: Math.max(0, dirVec.y) * level },
      { offset: { x: -4, y: 13 }, emit: { x: 0, y: 1 }, power: Math.max(0, -dirVec.y) * level },
    ];
    for (const nozzle of nozzles) {
      if (nozzle.power <= 0.001) continue;
      this.emissionCarry += dt * nozzle.power * (28 + nozzle.power * 46 + ship.speed * 0.06);
      while (this.emissionCarry >= 1) {
        this.emissionCarry--;
        this.particles.push(this.createParticle(ship, forward, nozzle));
      }
    }
  }

  private createParticle(ship: Model.Ship, forward: Vec2, nozzle: { offset: Vec2; emit: Vec2; power: number }): ExhaustParticle {
    const side = { x: -forward.y, y: forward.x };
    const emitWorld = this.rotate(nozzle.emit, ship.angle);
    const offsetWorld = this.rotate(nozzle.offset, ship.angle);
    const jitter = random(-1, 1);
    const life = random(0.4, 0.7);
    return new ExhaustParticle(
      add(ship.position, add(offsetWorld, scale(side, jitter * 3))),
      add(
        scale(ship.velocity, 0.1),
        add(scale(emitWorld, random(150, 230) * (0.55 + nozzle.power * 0.65)), scale(side, jitter * 18)),
      ),
      life,
      life,
      random(1.5, 4),
    );
  }

  private rotate(v: Vec2, angle: number): Vec2 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
  }
}
