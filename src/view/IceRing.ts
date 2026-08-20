import { length, sub } from '../math';
import type * as Model from '../model';
import { iceLocalVertex } from '../model/IceBlock';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing, RadialPaint } from './Drawing';
import type { StarLight, ShadowCasters } from './StarLight';

const SPARKLE_PERIOD = 1.8;

export class IceRing {
  private time = 0;

  update(dt: number): void { this.time += dt; }

  draw(
    drawing: Drawing,
    ring: Model.IceRing,
    star: Model.Star,
    shipPosition: Vec2,
    camera: Camera,
    starLight: StarLight,
    casters: ShadowCasters | null,
  ): void {
    if (!ring.isPlaced) return;
    const { width, height } = drawing.size;
    const visibleRange = Math.hypot(width, height) / camera.zoom * 0.7 + 80;
    ring.forEach((block) => {
      if (length(sub(block.position, shipPosition)) > visibleRange) return;
      this.drawBlock(drawing, block, star, camera.zoom, starLight, casters);
    });
  }

  private drawBlock(
    drawing: Drawing,
    block: Model.IceBlock,
    star: Model.Star,
    zoom: number,
    starLight: StarLight,
    casters: ShadowCasters | null,
  ): void {
    const points = block.vertices.map((_, index) => iceLocalVertex(block, index));
    drawing.withTransform(block.position, block.angle, () => {
      const localLight = starLight.localDirection(block.angle, block.position);
      const shadow = starLight.shadowFactor(block.position, block.radius, casters);
      const ice = starLight.bodyPaint(localLight, block.radius, '#d7f6ff', '#1a3c58', shadow);
      drawing.withShadow('#9fe9ff', 14, () => {
        drawing.polygon(points, ice, 'rgba(210,250,255,.55)', 1.4 / zoom);
      });
      if (points.length >= 3) {
        const inner = points.map((point) => ({ x: point.x * 0.45, y: point.y * 0.45 }));
        drawing.polygon(inner, 'rgba(255,255,255,.22)', 'rgba(230,250,255,.35)', 0.8 / zoom);
      }
    });
    this.drawSparkles(drawing, block, star, zoom);
  }

  private drawSparkles(drawing: Drawing, block: Model.IceBlock, star: Model.Star, zoom: number): void {
    if (!star.isPlaced) return;
    const toStar = sub(star.position, block.position);
    const starDist = length(toStar) || 1;
    const towardStar = { x: toStar.x / starDist, y: toStar.y / starDist };
    const phaseOff = hash(block.id);
    drawing.withAdditiveBlend(() => {
      for (let i = 0; i < block.vertices.length; i++) {
        const local = iceLocalVertex(block, i);
        const c = Math.cos(block.angle);
        const s = Math.sin(block.angle);
        const world: Vec2 = {
          x: block.position.x + local.x * c - local.y * s,
          y: block.position.y + local.x * s + local.y * c,
        };
        const facing = ((world.x - block.position.x) * towardStar.x + (world.y - block.position.y) * towardStar.y)
          / Math.max(1, block.radius);
        if (facing < 0.15) continue;
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(this.time * (1.3 + phaseOff) / SPARKLE_PERIOD + i * 1.7 + phaseOff * 8));
        const alpha = Math.min(1, facing * twinkle);
        const size = (1.6 + twinkle * 2.4) / zoom;
        const glow: RadialPaint = {
          from: world, fromRadius: 0,
          to: world, toRadius: size * 4,
          stops: [
            { offset: 0, color: `rgba(255,255,255,${(0.85 * alpha).toFixed(3)})` },
            { offset: 0.4, color: `rgba(180,245,255,${(0.45 * alpha).toFixed(3)})` },
            { offset: 1, color: 'rgba(160,230,255,0)' },
          ],
        };
        drawing.withShadow('#d9fbff', 8, () => {
          drawing.circle(world, size * 4, glow);
          drawing.line({ x: world.x - size * 2.4, y: world.y }, { x: world.x + size * 2.4, y: world.y }, `rgba(255,255,255,${alpha.toFixed(3)})`, 0.9 / zoom);
          drawing.line({ x: world.x, y: world.y - size * 2.4 }, { x: world.x, y: world.y + size * 2.4 }, `rgba(255,255,255,${alpha.toFixed(3)})`, 0.9 / zoom);
        });
      }
    });
  }
}

function hash(id: number): number {
  const n = Math.sin(id * 12.9898) * 43758.5453;
  return n - Math.floor(n);
}
