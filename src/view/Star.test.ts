import { describe, expect, it } from 'vitest';
import { Star as ModelStar } from '../model/Star';
import type { Drawing, RadialPaint } from './Drawing';
import { Star } from './Star';

describe('Star view', () => {
  it('REQ-94 draws a screen-scale glowing star', () => {
    const circles: Array<{ radius: number }> = [];
    const drawing = {
      withAdditiveBlend: (draw: () => void) => draw(),
      withShadow: (_color: string, _blur: number, draw: () => void) => draw(),
      circle: (_position: unknown, radius: number, _paint?: RadialPaint | string) => circles.push({ radius }),
    } as unknown as Drawing;
    const star = new ModelStar();
    star.placeAt({ x: 0, y: 0 });
    new Star().draw(drawing, star, { x: 0, y: 0 }, 20000);
    expect(circles.some((c) => c.radius >= star.radius)).toBe(true);
  });
});
