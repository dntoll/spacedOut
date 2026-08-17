import { describe, expect, it } from 'vitest';
import { Asteroid } from '../model/Asteroid';
import { MassiveAsteroid } from '../model/MassiveAsteroid';
import { Ship } from '../model/Ship';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import { Camera } from './Camera';
import type { Drawing } from './Drawing';
import { SpaceDust } from './SpaceDust';

interface DrawnCircle { x: number; y: number; size: number; color: string }

function countingDrawing(): { drawing: Drawing; circles: DrawnCircle[] } {
  const circles: DrawnCircle[] = [];
  const drawing = {
    withAdditiveBlend: (draw: () => void) => draw(),
    circle: (position: Vec2, size: number, color: string) => circles.push({ x: position.x, y: position.y, size, color }),
  } as unknown as Drawing;
  return { drawing, circles };
}

function stubModel(ship: Ship, asteroids: Asteroid[] = [], massives: MassiveAsteroid[] = []): Model.Game {
  return {
    ship,
    asteroidBelt: { forEach: (fn: (a: Asteroid) => void) => asteroids.forEach(fn) },
    massiveAsteroidField: { forEachActive: (fn: (a: MassiveAsteroid) => void) => massives.forEach(fn) },
  } as unknown as Model.Game;
}

const VIEWPORT = { width: 800, height: 600 };

describe('SpaceDust', () => {
  it('REQ-31 spawns ambient particles up to a target population', () => {
    const dust = new SpaceDust();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();

    dust.update(5, stubModel(ship), camera, VIEWPORT);
    dust.draw(drawing);

    expect(circles.length).toBe(240);
  });

  it('REQ-31 spawns particles outside the visible range with random directions', () => {
    const dust = new SpaceDust();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();
    const radius = camera.getVisibleWorldRadius(VIEWPORT);
    const center = camera.worldPosition;

    dust.update(5, stubModel(ship), camera, VIEWPORT);
    dust.draw(drawing);

    expect(circles.length).toBe(240);
    expect(circles.every((c) => Math.hypot(c.x - center.x, c.y - center.y) > radius)).toBe(true);

    const before = circles.map((c) => Math.hypot(c.x - center.x, c.y - center.y));
    dust.update(0.5, stubModel(ship), camera, VIEWPORT);
    circles.length = 0;
    dust.draw(drawing);
    const after = circles.map((c) => Math.hypot(c.x - center.x, c.y - center.y));
    expect(after.length).toBe(before.length);
    const movedInward = after.filter((d, i) => d < before[i]).length;
    const movedOutward = after.length - movedInward;
    expect(movedInward).toBeGreaterThan(0);
    expect(movedOutward).toBeGreaterThan(0);
  });

  it('REQ-31 keeps spawning ambient edge particles even while exhaust is adopted', () => {
    const dust = new SpaceDust();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();

    for (let i = 0; i < 300; i++) dust.adopt({ x: 0, y: 0 }, { x: 100, y: 0 });
    dust.update(5, stubModel(ship), camera, VIEWPORT);
    dust.draw(drawing);

    const radius = camera.getVisibleWorldRadius(VIEWPORT);
    const center = camera.worldPosition;
    const edgeParticles = circles.filter((c) => Math.hypot(c.x - center.x, c.y - center.y) > radius).length;
    expect(edgeParticles).toBe(240);
  });

  it('REQ-31 removes particles that leave the visible range', () => {
    const dust = new SpaceDust();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();

    dust.update(5, stubModel(ship), camera, VIEWPORT);
    camera.update({ x: 100000, y: 0 }, 0, 0);
    dust.update(0, stubModel(ship), camera, VIEWPORT);
    dust.draw(drawing);

    expect(circles.length).toBe(0);
  });

  it('REQ-31 bounces dust visually off the ship', () => {
    const dust = new SpaceDust();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();

    dust.adopt({ x: 10, y: 0 }, { x: -50, y: 0 });
    dust.update(0, stubModel(ship), camera, VIEWPORT);
    dust.draw(drawing);

    const particle = circles.find((c) => c.x > 18 && c.x < 21);
    expect(particle).toBeDefined();

    circles.length = 0;
    dust.update(0.01, stubModel(ship), camera, VIEWPORT);
    dust.draw(drawing);
    const moved = circles.find((c) => c.x > 18 && c.x < 22);
    expect(moved!.x).toBeGreaterThan(particle!.x);
  });

  it('REQ-31 bounces dust visually off regular asteroids using their circle', () => {
    const dust = new SpaceDust();
    const camera = new Camera();
    const ship = new Ship();
    const asteroid = new Asteroid(0, { x: 200, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1, 1], 0.5);
    const { drawing, circles } = countingDrawing();

    dust.adopt({ x: 210, y: 0 }, { x: -50, y: 0 });
    dust.update(0, stubModel(ship, [asteroid]), camera, VIEWPORT);
    dust.draw(drawing);

    const particle = circles.find((c) => c.x > 230 && c.x < 233);
    expect(particle).toBeDefined();
  });

  it('REQ-31 does not bounce off massive asteroids in concave notches outside the outline', () => {
    const dust = new SpaceDust();
    const camera = new Camera();
    const ship = new Ship();
    const massives = [new MassiveAsteroid(0, { x: 0, y: 0 }, 100, 0, [1, 0.2, 1, 0.2, 1, 0.2], [], 0.5)];
    const { drawing, circles } = countingDrawing();

    const notchAngle = Math.PI / 3;
    const notchPosition = { x: Math.cos(notchAngle) * 60, y: Math.sin(notchAngle) * 60 };
    dust.adopt(notchPosition, { x: 0, y: 0 });
    dust.update(0, stubModel(ship, [], massives), camera, VIEWPORT);
    dust.draw(drawing);

    const particle = circles.find((c) => Math.abs(c.x - notchPosition.x) < 1 && Math.abs(c.y - notchPosition.y) < 1);
    expect(particle).toBeDefined();
  });

  it('REQ-31 bounces dust off a massive asteroid when inside its outline', () => {
    const dust = new SpaceDust();
    const camera = new Camera();
    const ship = new Ship();
    const massives = [new MassiveAsteroid(0, { x: 0, y: 0 }, 100, 0, [1, 0.2, 1, 0.2, 1, 0.2], [], 0.5)];
    const { drawing, circles } = countingDrawing();

    dust.adopt({ x: 0, y: 0 }, { x: 0, y: 0 });
    dust.update(0, stubModel(ship, [], massives), camera, VIEWPORT);
    dust.draw(drawing);

    const moved = circles.find((c) => Math.hypot(c.x, c.y) > 20);
    expect(moved).toBeDefined();
  });

  it('REQ-32 scales particle opacity by the visibility setting', () => {
    const dust = new SpaceDust();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();

    dust.update(5, stubModel(ship), camera, VIEWPORT);
    dust.setVisibility(1);
    dust.draw(drawing);
    const fullAlpha = circles[0].color;

    circles.length = 0;
    dust.setVisibility(0);
    dust.draw(drawing);
    const zeroAlpha = circles[0].color;

    expect(fullAlpha).toMatch(/0\.6/);
    expect(zeroAlpha).toMatch(/0\b|0\)/);
    expect(zeroAlpha).not.toMatch(/0\.6/);
  });
});
