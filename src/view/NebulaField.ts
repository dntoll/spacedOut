import { add, length, random, scale, sub } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing, Size, RadialPaint } from './Drawing';
import { NebulaParticle, type NebulaColor } from './NebulaParticle';

const CLOUD_GAP_BASE = 15000;
const CLOUD_GAP_JITTER = 15000;
const CLOUD_SIZE = 200;
const CLOUD_SPREAD = 1732;
const CLOUD_ASPECT_MIN = 1.4;
const CLOUD_ASPECT_MAX = 2.6;
const PERIPHERAL_FRACTION = 0.5;
const ISLAND_CLEARANCE = 600;
const PARTICLE_MIN = 50;
const PARTICLE_MAX = 120;
const PARTICLE_ALPHA = 0.5;
const CULL_MARGIN = 400 + CLOUD_SPREAD * CLOUD_ASPECT_MAX + 800;

const PALETTE: NebulaColor[] = [
  { r: 180, g: 90, b: 220 },
  { r: 90, g: 140, b: 230 },
  { r: 230, g: 100, b: 180 },
  { r: 80, g: 200, b: 200 },
  { r: 140, g: 110, b: 230 },
];

export class NebulaField {
  private particles: NebulaParticle[] = [];
  private lastCloudProgress = -CLOUD_GAP_BASE;
  private nextGap = CLOUD_GAP_BASE;

  reset(): void { this.particles = []; this.lastCloudProgress = -CLOUD_GAP_BASE; this.nextGap = CLOUD_GAP_BASE; }

  update(dt: number, model: Model.Game, camera: Camera, viewport: Size): void {
    if (!model.mission.isTraversal) {
      this.particles = [];
      this.lastCloudProgress = -CLOUD_GAP_BASE;
      this.nextGap = CLOUD_GAP_BASE;
      return;
    }
    this.spawn(model, camera, viewport);
    for (const particle of this.particles) particle.update(dt, model.ship.position);
    this.cull(model.ship.position, camera, viewport);
  }

  draw(drawing: Drawing): void {
    drawing.withAdditiveBlend(() => {
      for (const particle of this.particles) {
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
    });
  }

  private spawn(model: Model.Game, camera: Camera, viewport: Size): void {
    const direction = model.mission.signalDirection;
    if (!direction) return;
    const ship = model.ship.position;
    const progress = ship.x * direction.x + ship.y * direction.y;
    const visibleRadius = camera.getVisibleWorldRadius(viewport);
    const spawnAhead = visibleRadius + 400;
    const perp: Vec2 = { x: -direction.y, y: direction.x };
    while (progress >= this.lastCloudProgress + this.nextGap) {
      this.lastCloudProgress += this.nextGap;
      this.nextGap = CLOUD_GAP_BASE + random(0, CLOUD_GAP_JITTER);
      const routeCenter = add(ship, scale(direction, spawnAhead));
      let cloudCenter = routeCenter;
      if (random(0, 1) < PERIPHERAL_FRACTION) {
        const lateral = random(-1, 1) * visibleRadius * 0.8;
        cloudCenter = add(routeCenter, scale(perp, lateral));
      }
      if (this.nearIsland(model, cloudCenter)) continue;
      const aspect = random(CLOUD_ASPECT_MIN, CLOUD_ASPECT_MAX);
      const rotation = random(0, Math.PI * 2);
      const a = CLOUD_SPREAD * aspect;
      const b = CLOUD_SPREAD / aspect;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const color = PALETTE[Math.floor(random(0, PALETTE.length))];
      for (let i = 0; i < CLOUD_SIZE; i++) {
        const angle = random(0, Math.PI * 2);
        const t = Math.sqrt(random(0, 1));
        const local: Vec2 = { x: a * t * Math.cos(angle), y: b * t * Math.sin(angle) };
        const home = add(cloudCenter, {
          x: local.x * cos - local.y * sin,
          y: local.x * sin + local.y * cos,
        });
        const size = random(PARTICLE_MIN, PARTICLE_MAX);
        const tint = this.tint(color);
        this.particles.push(new NebulaParticle({ ...home }, home, size, tint, PARTICLE_ALPHA));
      }
    }
  }

  private nearIsland(model: Model.Game, cloudCenter: Vec2): boolean {
    let blocked = false;
    model.asteroidBelt.forEachIsland((island) => {
      if (blocked) return;
      const clearance = island.radius + CLOUD_SPREAD + ISLAND_CLEARANCE;
      if (length(sub(island.center, cloudCenter)) <= clearance) blocked = true;
    });
    return blocked;
  }

  private tint(base: NebulaColor): NebulaColor {
    const jitter = 30;
    return {
      r: Math.max(0, Math.min(255, base.r + random(-jitter, jitter))),
      g: Math.max(0, Math.min(255, base.g + random(-jitter, jitter))),
      b: Math.max(0, Math.min(255, base.b + random(-jitter, jitter))),
    };
  }

  private cull(shipPosition: Vec2, camera: Camera, viewport: Size): void {
    const maxDist = camera.getVisibleWorldRadius(viewport) + CULL_MARGIN;
    this.particles = this.particles.filter((p) => length(sub(p.position, shipPosition)) <= maxDist);
  }
}
