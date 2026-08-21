import { describe, expect, it } from 'vitest';
import { IceRing as ModelIceRing } from '../model/IceRing';
import { Star } from '../model/Star';
import type { Drawing } from './Drawing';
import { IceRing } from './IceRing';
import { StarLight } from './StarLight';
import { Camera } from './Camera';

describe('IceRing view', () => {
  it('REQ-96 draws faceted ice with sparkles facing the star', () => {
    const star = new Star();
    star.placeAt({ x: 0, y: 0 }, 100);
    const ring = new ModelIceRing();
    ring.placeAround(star);
    const polygons: unknown[] = [];
    const circles: unknown[] = [];
    const lines: unknown[] = [];
    const drawing = {
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      withShadow: (_color: string, _blur: number, draw: () => void) => draw(),
      withAdditiveBlend: (draw: () => void) => draw(),
      polygon: (...args: unknown[]) => polygons.push(args),
      circle: (...args: unknown[]) => circles.push(args),
      line: (...args: unknown[]) => lines.push(args),
      size: { width: 800, height: 600 },
    } as unknown as Drawing;
    const camera = new Camera();
    camera.setViewport({ width: 800, height: 600 });
    let target = { x: 0, y: 0 };
    ring.forEach((block) => { if (block.id === 0) target = { ...block.position }; });
    const view = new IceRing();
    view.update(0.4);
    view.draw(drawing, ring, star, target, camera, new StarLight(), null);

    expect(polygons.length).toBeGreaterThan(0);
    expect(circles.length + lines.length).toBeGreaterThan(0);
  });
});
