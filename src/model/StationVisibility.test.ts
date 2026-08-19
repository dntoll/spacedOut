import { describe, expect, it } from 'vitest';
import { StationVisibility } from './StationVisibility';
import type { Vec2 } from '../types';

const pointInPolygon = (x: number, y: number, poly: Vec2[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
};

describe('StationVisibility', () => {
  it('REQ-84 produces a forward cone polygon that contains points ahead and excludes points behind', () => {
    const origin: Vec2 = { x: 0, y: 0 };
    const polygon = StationVisibility.compute(origin, 0, Math.PI / 4, 500, []);

    expect(polygon.length).toBeGreaterThanOrEqual(3);
    expect(pointInPolygon(150, 0, polygon)).toBe(true);
    expect(pointInPolygon(-150, 0, polygon)).toBe(false);
  });

  it('REQ-83 stops the cone at a wall segment, excluding points beyond it', () => {
    const origin: Vec2 = { x: 0, y: 0 };
    const segments = [{ a: { x: 200, y: -300 }, b: { x: 200, y: 300 } }];
    const polygon = StationVisibility.compute(origin, 0, Math.PI / 3, 500, segments);

    expect(pointInPolygon(100, 0, polygon)).toBe(true);
    expect(pointInPolygon(350, 0, polygon)).toBe(false);
  });

  it('REQ-84 extends to the range limit when no wall blocks', () => {
    const origin: Vec2 = { x: 0, y: 0 };
    const polygon = StationVisibility.compute(origin, 0, Math.PI / 6, 400, []);
    expect(polygon.length).toBeGreaterThanOrEqual(3);
    expect(pointInPolygon(350, 0, polygon)).toBe(true);
  });
});
