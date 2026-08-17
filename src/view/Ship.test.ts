import { describe, expect, it, vi } from 'vitest';
import { Ship as ModelShip } from '../model/Ship';
import type { Drawing, RadialPaint } from './Drawing';
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

  it('REQ-38 draws side-nozzle glows when directional thrust is active', () => {
    const circles: Array<{ position: { x: number; y: number } }> = [];
    const drawing = {
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      withShadow: (_color: string, _blur: number, draw: () => void) => draw(),
      polygon: vi.fn(),
      circle: (position: { x: number; y: number }, _radius: number, _paint: RadialPaint) => circles.push({ position: { ...position } }),
    } as unknown as Drawing;

    const idle = new ModelShip();
    new Ship().draw(drawing, idle);
    const idleCount = circles.length;
    expect(idleCount).toBe(0);

    const ship = new ModelShip();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    ship.setDirectionalThrust({ x: 0, y: -1 });
    ship.applyControls(0.2);
    circles.length = 0;
    new Ship().draw(drawing, ship);

    expect(circles.length).toBeGreaterThan(0);
    const sideNozzle = circles.find((c) => c.position.y > 10);
    expect(sideNozzle).toBeDefined();
  });
});
