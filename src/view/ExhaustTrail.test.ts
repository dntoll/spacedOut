import { describe, expect, it, vi } from 'vitest';
import { Ship } from '../model/Ship';
import type { Drawing } from './Drawing';
import { ExhaustTrail } from './ExhaustTrail';

describe('ExhaustTrail', () => {
  it('REQ-10 emits world-space particles behind the thrust direction', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const circles: Array<{ x: number; y: number }> = [];
    const drawing = {
      withAdditiveBlend: (draw: () => void) => draw(),
      circle: (position: { x: number; y: number }) => circles.push({ ...position }),
    } as unknown as Drawing;
    const ship = new Ship();
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    ship.applyControls(0);
    const trail = new ExhaustTrail();

    trail.update(0.5, ship);
    trail.draw(drawing);
    expect(circles.length).toBeGreaterThan(0);
    expect(circles.every((particle) => particle.x < ship.position.x)).toBe(true);

    ship.stopThrust();
    ship.position = { x: 500, y: 0 };
    circles.length = 0;
    trail.update(0.01, ship);
    trail.draw(drawing);
    expect(circles.every((particle) => particle.x < 500)).toBe(true);
    vi.restoreAllMocks();
  });
});
