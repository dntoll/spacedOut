import { describe, expect, it, vi } from 'vitest';
import { SpaceStation as ModelSpaceStation } from '../model/SpaceStation';
import type { Drawing, Paint } from './Drawing';
import { SpaceStation } from './SpaceStation';
import { StarLight } from './StarLight';

describe('SpaceStation view', () => {
  it('REQ-64 draws a large rusty abandoned station with radial arms, modules, and dead windows', () => {
    const polygons = vi.fn();
    const rectangles: Paint[] = [];
    const circles: Paint[] = [];
    const drawing = {
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      polygon: polygons,
      rectangle: (_position: unknown, _size: unknown, fill: Paint) => rectangles.push(fill),
      circle: (_position: unknown, _radius: number, fill: Paint) => circles.push(fill),
      line: vi.fn(),
    } as unknown as Drawing;

    new SpaceStation().draw(
      drawing,
      new ModelSpaceStation({ x: 100, y: 200 }, 2000, 0),
      1,
      new StarLight(),
    );

    expect(polygons).toHaveBeenCalled();
    expect(rectangles).toHaveLength(8);
    expect(rectangles).toContain('#603723');
    expect(rectangles).toContain('#855033');
    expect(circles).toContain('#180d09');
    expect(circles).toContain('#b56b38');
  });
});
