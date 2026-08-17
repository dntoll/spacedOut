import { describe, expect, it, vi } from 'vitest';
import { Ship } from '../model/Ship';
import type { Vec2 } from '../types';
import { Camera } from './Camera';
import type { Drawing } from './Drawing';
import { ExhaustTrail } from './ExhaustTrail';

const VIEWPORT = { width: 800, height: 600 };

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
    const camera = new Camera();
    const trail = new ExhaustTrail();

    trail.update(0.5, ship, camera, VIEWPORT);
    trail.draw(drawing);
    expect(circles.length).toBeGreaterThan(0);
    expect(circles.every((particle) => particle.x < ship.position.x)).toBe(true);

    ship.stopThrust();
    ship.position = { x: 500, y: 0 };
    circles.length = 0;
    trail.update(0.01, ship, camera, VIEWPORT);
    trail.draw(drawing);
    expect(circles.every((particle) => particle.x < 500)).toBe(true);
    vi.restoreAllMocks();
  });

  it('REQ-10 hands expired exhaust particles off as atmospheric dust', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const adopted: Array<{ position: Vec2; velocity: Vec2 }> = [];
    const trail = new ExhaustTrail((position, velocity) => adopted.push({ position: { ...position }, velocity: { ...velocity } }));
    const ship = new Ship();
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    ship.applyControls(0);
    const camera = new Camera();

    trail.update(0.5, ship, camera, VIEWPORT);
    expect(adopted).toHaveLength(0);

    ship.stopThrust();
    trail.update(1, ship, camera, VIEWPORT);

    expect(adopted.length).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it('REQ-10 despawns exhaust particles that leave the visible range', () => {
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
    const camera = new Camera();
    const trail = new ExhaustTrail();

    trail.update(0.5, ship, camera, VIEWPORT);
    trail.draw(drawing);
    expect(circles.length).toBeGreaterThan(0);

    camera.update({ x: 100000, y: 0 }, 0, 0);
    circles.length = 0;
    trail.update(0, ship, camera, VIEWPORT);
    trail.draw(drawing);
    expect(circles.length).toBe(0);
    vi.restoreAllMocks();
  });
});
