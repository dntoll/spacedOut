import { describe, expect, it, vi } from 'vitest';
import { Ship as ModelShip } from '../model/Ship';
import type { Drawing } from './Drawing';
import { Ship } from './Ship';

describe('Ship view', () => {
  it('REQ-04 draws the ship body as a triangle', () => {
    const polygons: Array<Array<{ x: number; y: number }>> = [];
    const drawing = {
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      withShadow: (_color: string, _blur: number, draw: () => void) => draw(),
      polygon: (points: Array<{ x: number; y: number }>) => polygons.push(points),
      circle: vi.fn(),
    } as unknown as Drawing;

    new Ship().draw(drawing, new ModelShip());

    expect(polygons[0]).toHaveLength(3);
  });
});
