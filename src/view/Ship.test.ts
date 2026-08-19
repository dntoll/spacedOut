import { describe, expect, it, vi } from 'vitest';
import { Ship as ModelShip } from '../model/Ship';
import type { Drawing, RadialPaint } from './Drawing';
import { Ship } from './Ship';
import { StarLight } from './StarLight';

describe('Ship view', () => {
  it('REQ-04 draws the ship body as a triangle', () => {
    const polygons: Array<Array<{ x: number; y: number }>> = [];
    const drawing = {
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      withShadow: (_color: string, _blur: number, draw: () => void) => draw(),
      polygon: (points: Array<{ x: number; y: number }>) => polygons.push(points),
      circle: vi.fn(),
    } as unknown as Drawing;

    new Ship().draw(drawing, new ModelShip(), new StarLight(), null);

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
    new Ship().draw(drawing, idle, new StarLight(), null);
    const idleCount = circles.length;
    expect(idleCount).toBe(0);

    const ship = new ModelShip();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    ship.setDirectionalThrust({ x: 0, y: -1 });
    ship.applyControls(0.2);
    circles.length = 0;
    new Ship().draw(drawing, ship, new StarLight(), null);

    expect(circles.length).toBeGreaterThan(0);
    const sideNozzle = circles.find((c) => c.position.y > 10);
    expect(sideNozzle).toBeDefined();
  });

  it('REQ-69 draws a left wing gun at level 1 and both wing guns at level 2', () => {
    const polygons: Array<Array<{ x: number; y: number }>> = [];
    const drawing = {
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      withShadow: (_color: string, _blur: number, draw: () => void) => draw(),
      polygon: (points: Array<{ x: number; y: number }>) => polygons.push(points),
      circle: vi.fn(),
    } as unknown as Drawing;

    const level0 = new ModelShip();
    new Ship().draw(drawing, level0, new StarLight(), null);
    const baseCount = polygons.length;
    expect(baseCount).toBe(2);

    const level1 = new ModelShip();
    level1.upgradeWeapon();
    polygons.length = 0;
    new Ship().draw(drawing, level1, new StarLight(), null);
    expect(polygons.length).toBe(baseCount + 1);

    const level2 = new ModelShip();
    level2.upgradeWeapon();
    level2.upgradeWeapon();
    polygons.length = 0;
    new Ship().draw(drawing, level2, new StarLight(), null);
    expect(polygons.length).toBe(baseCount + 2);
    const wingGuns = polygons.filter((points) => points.length === 4);
    expect(wingGuns).toHaveLength(2);
  });

  it('REQ-77 draws a circle around the ship while it is invulnerable', () => {
    const circles: Array<{ position: { x: number; y: number }; radius: number }> = [];
    const drawing = {
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      withShadow: (_color: string, _blur: number, draw: () => void) => draw(),
      polygon: vi.fn(),
      circle: (position: { x: number; y: number }, radius: number, _paint: RadialPaint) =>
        circles.push({ position: { ...position }, radius }),
    } as unknown as Drawing;

    const safe = new ModelShip();
    expect(safe.isInvulnerable).toBe(false);
    new Ship().draw(drawing, safe, new StarLight(), null);
    expect(circles).toHaveLength(0);

    const hit = new ModelShip();
    hit.takeDamage(10);
    expect(hit.isInvulnerable).toBe(true);
    circles.length = 0;
    new Ship().draw(drawing, hit, new StarLight(), null);
    expect(circles).toHaveLength(1);
    expect(circles[0].position).toEqual({ x: 0, y: 0 });
    expect(circles[0].radius).toBeGreaterThan(22);

    hit.updateInvulnerability(0.6);
    expect(hit.isInvulnerable).toBe(false);
    circles.length = 0;
    new Ship().draw(drawing, hit, new StarLight(), null);
    expect(circles).toHaveLength(0);
  });
});
