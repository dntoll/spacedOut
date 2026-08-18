import { describe, expect, it, vi } from 'vitest';
import { Asteroid } from '../model/Asteroid';
import { Collision } from '../model/Collision';
import { MassiveAsteroid } from '../model/MassiveAsteroid';
import { Ship } from '../model/Ship';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import { Camera } from './Camera';
import type { Drawing } from './Drawing';
import { ParticleField } from './ParticleField';
import { StarLight, type ShadowCasters } from './StarLight';

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
    droneField: { forEach: () => {} },
  } as unknown as Model.Game;
}

const VIEWPORT = { width: 800, height: 600 };

describe('ParticleField', () => {
  it('REQ-31 spawns ambient particles up to a target population', () => {
    const field = new ParticleField();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();

    field.update(5, stubModel(ship), camera, VIEWPORT);
    field.draw(drawing);

    expect(circles.length).toBe(240);
  });

  it('REQ-31 spawns particles outside the visible range with random directions', () => {
    const field = new ParticleField();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();
    const radius = camera.getVisibleWorldRadius(VIEWPORT);
    const center = camera.worldPosition;

    field.update(5, stubModel(ship), camera, VIEWPORT);
    field.draw(drawing);

    expect(circles.length).toBe(240);
    expect(circles.every((c) => Math.hypot(c.x - center.x, c.y - center.y) > radius)).toBe(true);

    const before = circles.map((c) => Math.hypot(c.x - center.x, c.y - center.y));
    field.update(0.5, stubModel(ship), camera, VIEWPORT);
    circles.length = 0;
    field.draw(drawing);
    const after = circles.map((c) => Math.hypot(c.x - center.x, c.y - center.y));
    expect(after.length).toBe(before.length);
    const movedInward = after.filter((d, i) => d < before[i]).length;
    const movedOutward = after.length - movedInward;
    expect(movedInward).toBeGreaterThan(0);
    expect(movedOutward).toBeGreaterThan(0);
  });

  it('REQ-31 tops the field up to a target population, counting all particles regardless of origin', () => {
    const field = new ParticleField();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();

    for (let i = 0; i < 100; i++) field.adopt({ x: 0, y: 0 }, { x: 100, y: 0 });
    field.update(5, stubModel(ship), camera, VIEWPORT);
    field.draw(drawing);
    expect(circles.length).toBe(240);

    const field2 = new ParticleField();
    const { drawing: d2, circles: c2 } = countingDrawing();
    for (let i = 0; i < 300; i++) field2.adopt({ x: 0, y: 0 }, { x: 100, y: 0 });
    field2.update(5, stubModel(ship), camera, VIEWPORT);
    field2.draw(d2);
    expect(c2.length).toBe(300);
  });

  it('REQ-31 removes particles that leave the visible range', () => {
    const field = new ParticleField();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();

    field.update(5, stubModel(ship), camera, VIEWPORT);
    camera.update({ x: 100000, y: 0 }, { x: 0, y: 0 }, 0);
    field.update(0, stubModel(ship), camera, VIEWPORT);
    field.draw(drawing);

    expect(circles.length).toBe(0);
  });

  it('REQ-31 bounces dust visually off the ship', () => {
    const field = new ParticleField();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();

    field.adopt({ x: 10, y: 0 }, { x: -50, y: 0 });
    field.update(0, stubModel(ship), camera, VIEWPORT);
    field.draw(drawing);

    const particle = circles.find((c) => c.x > 18 && c.x < 21);
    expect(particle).toBeDefined();

    circles.length = 0;
    field.update(0.01, stubModel(ship), camera, VIEWPORT);
    field.draw(drawing);
    const moved = circles.find((c) => c.x > 18 && c.x < 22);
    expect(moved!.x).toBeGreaterThan(particle!.x);
  });

  it('REQ-31 bounces dust visually off regular asteroids using their circle', () => {
    const field = new ParticleField();
    const camera = new Camera();
    const ship = new Ship();
    const asteroid = new Asteroid(0, { x: 200, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1, 1], 0.5);
    const { drawing, circles } = countingDrawing();

    field.adopt({ x: 210, y: 0 }, { x: -50, y: 0 });
    field.update(0, stubModel(ship, [asteroid]), camera, VIEWPORT);
    field.draw(drawing);

    const particle = circles.find((c) => c.x > 230 && c.x < 233);
    expect(particle).toBeDefined();
  });

  it('REQ-31 does not bounce off massive asteroids in concave notches outside the outline', () => {
    const field = new ParticleField();
    const camera = new Camera();
    const ship = new Ship();
    const massives = [new MassiveAsteroid(0, { x: 0, y: 0 }, 100, 0, [1, 0.2, 1, 0.2, 1, 0.2], [], 0.5)];
    const { drawing, circles } = countingDrawing();

    const notchAngle = Math.PI / 3;
    const notchPosition = { x: Math.cos(notchAngle) * 60, y: Math.sin(notchAngle) * 60 };
    field.adopt(notchPosition, { x: 0, y: 0 });
    field.update(0, stubModel(ship, [], massives), camera, VIEWPORT);
    field.draw(drawing);

    const particle = circles.find((c) => Math.abs(c.x - notchPosition.x) < 1 && Math.abs(c.y - notchPosition.y) < 1);
    expect(particle).toBeDefined();
  });

  it('REQ-31 bounces dust off a massive asteroid when inside its outline', () => {
    const field = new ParticleField();
    const camera = new Camera();
    const ship = new Ship();
    const massives = [new MassiveAsteroid(0, { x: 0, y: 0 }, 100, 0, [1, 0.2, 1, 0.2, 1, 0.2], [], 0.5)];
    const { drawing, circles } = countingDrawing();

    field.adopt({ x: 0, y: 0 }, { x: 0, y: 0 });
    field.update(0, stubModel(ship, [], massives), camera, VIEWPORT);
    field.draw(drawing);

    const moved = circles.find((c) => Math.hypot(c.x, c.y) > 20);
    expect(moved).toBeDefined();
  });

  it('REQ-32 scales particle opacity by the visibility setting', () => {
    const field = new ParticleField();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();

    field.update(5, stubModel(ship), camera, VIEWPORT);
    field.setVisibility(1);
    field.draw(drawing);
    const fullAlpha = circles[0].color;

    circles.length = 0;
    field.setVisibility(0);
    field.draw(drawing);
    const zeroAlpha = circles[0].color;

    expect(fullAlpha).toMatch(/0\.6/);
    expect(zeroAlpha).toMatch(/0\b|0\)/);
    expect(zeroAlpha).not.toMatch(/0\.6/);
  });

  it('REQ-10 emits world-space particles behind the thrust direction', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const ship = new Ship();
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    ship.applyControls(0);
    const camera = new Camera();
    const field = new ParticleField();
    const { drawing, circles } = countingDrawing();

    field.update(0.5, stubModel(ship), camera, VIEWPORT);
    field.draw(drawing);

    const radius = camera.getVisibleWorldRadius(VIEWPORT);
    const exhaust = circles.filter((c) => Math.hypot(c.x, c.y) < radius);
    expect(exhaust.length).toBeGreaterThan(0);
    expect(exhaust.every((c) => c.x < ship.position.x)).toBe(true);
    vi.restoreAllMocks();
  });

  it('REQ-10 keeps exhaust particles as atmospheric dust after their burn', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const ship = new Ship();
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    ship.applyControls(0);
    const camera = new Camera();
    const field = new ParticleField();
    const { drawing, circles } = countingDrawing();

    field.update(0.5, stubModel(ship), camera, VIEWPORT);
    field.draw(drawing);
    const before = circles.length;

    ship.stopThrust();
    field.update(1, stubModel(ship), camera, VIEWPORT);
    circles.length = 0;
    field.draw(drawing);

    expect(before).toBeGreaterThan(0);
    expect(circles.length).toBeGreaterThanOrEqual(before);
    const cooled = circles.find((c) => Math.abs(c.x + 357) < 3 && Math.abs(c.y) < 3);
    expect(cooled).toBeDefined();
    expect(cooled!.color).toMatch(/120,200,235/);
    vi.restoreAllMocks();
  });

  it('REQ-10 despawns particles that leave the visible range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const ship = new Ship();
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    ship.applyControls(0);
    const camera = new Camera();
    const field = new ParticleField();
    const { drawing, circles } = countingDrawing();

    field.update(0.5, stubModel(ship), camera, VIEWPORT);
    field.draw(drawing);
    expect(circles.length).toBeGreaterThan(0);

    camera.update({ x: 100000, y: 0 }, { x: 0, y: 0 }, 0);
    circles.length = 0;
    field.update(0, stubModel(ship), camera, VIEWPORT);
    field.draw(drawing);
    expect(circles.length).toBe(0);
    vi.restoreAllMocks();
  });

  it('REQ-13 creates visible particles from collision observations', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { drawing, circles } = countingDrawing();
    const field = new ParticleField();

    field.emitCollision(new Collision({ x: 10, y: 20 }, { x: 1, y: 0 }, 100));
    field.draw(drawing);

    expect(circles.length).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it('REQ-13 keeps collision particles as atmospheric dust after their burn', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const field = new ParticleField();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();

    field.emitCollision(new Collision({ x: 100, y: 0 }, { x: 1, y: 0 }, 100));
    field.update(1.5, stubModel(ship), camera, VIEWPORT);
    field.draw(drawing);

    expect(circles.length).toBeGreaterThanOrEqual(12);
    const cooled = circles.find((c) => c.color.match(/120,200,235/));
    expect(cooled).toBeDefined();
    vi.restoreAllMocks();
  });

  it('REQ-35 emits a large particle burst on damage', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { drawing, circles } = countingDrawing();
    const field = new ParticleField();

    field.emitDamageBurst({ x: 0, y: 0 });
    field.draw(drawing);

    expect(circles.length).toBeGreaterThanOrEqual(40);
    vi.restoreAllMocks();
  });

  it('REQ-36 emits an explosion burst when the ship is destroyed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { drawing, circles } = countingDrawing();
    const field = new ParticleField();

    field.emitExplosion({ x: 0, y: 0 });
    field.draw(drawing);

    expect(circles.length).toBeGreaterThanOrEqual(150);
    vi.restoreAllMocks();
  });

  it('REQ-36 keeps explosion particles as atmospheric dust after their burn', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const field = new ParticleField();
    const camera = new Camera();
    const ship = new Ship();
    const { drawing, circles } = countingDrawing();

    field.emitExplosion({ x: 100, y: 0 });
    field.update(2.6, stubModel(ship), camera, VIEWPORT);
    field.draw(drawing);

    expect(circles.length).toBeGreaterThanOrEqual(150);
    const cooled = circles.find((c) => c.color.match(/120,200,235/));
    expect(cooled).toBeDefined();
    vi.restoreAllMocks();
  });

  it('REQ-35 explosion particles take the tint of the destroyed drone or pirate', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { drawing, circles } = countingDrawing();
    const field = new ParticleField();

    field.emitExplosion({ x: 0, y: 0 }, { r: 93, g: 184, b: 255 });
    field.draw(drawing);

    expect(circles.some((c) => c.color.startsWith('rgba(93,184,255,'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('REQ-71 freshly-spawned explosion and collision particles burn brighter and longer before cooling to dust', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const explosionDrawing = countingDrawing();
    const field = new ParticleField();

    field.emitExplosion({ x: 0, y: 0 });
    field.draw(explosionDrawing.drawing);

    const hot = explosionDrawing.circles.filter((c) => c.color.startsWith('rgba(220,250,255,'));
    expect(hot.length).toBeGreaterThan(explosionDrawing.circles.length * 0.8);

    const collisionDrawing = countingDrawing();
    const collisionField = new ParticleField();
    collisionField.emitCollision(new Collision({ x: 100, y: 0 }, { x: 1, y: 0 }, 100));
    collisionField.update(0.7, stubModel(new Ship()), new Camera(), VIEWPORT);
    collisionField.draw(collisionDrawing.drawing);

    const stillBurning = collisionDrawing.circles.filter((c) => !c.color.match(/120,200,235/));
    expect(stillBurning.length).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it('REQ-71 darkens atmospheric particles that fall within an asteroid shadow', () => {
    const field = new ParticleField();
    const star = new StarLight({ x: 0.6, y: 0.8 }, 2400);
    const casters: ShadowCasters = { forEachCaster: (fn) => fn({ position: { x: 0, y: 0 }, radius: 500 }) };
    field.adopt({ x: 0.6 * 100, y: 0.8 * 100 }, { x: 0, y: 0 });
    field.adopt({ x: -1000, y: -1000 }, { x: 0, y: 0 });

    const lit = countingDrawing();
    field.draw(lit.drawing);
    const shadowed = countingDrawing();
    field.draw(shadowed.drawing, star, casters);

    expect(lit.circles).toHaveLength(2);
    expect(shadowed.circles).toHaveLength(2);
    const alphaOf = (c: DrawnCircle): number => parseFloat(c.color.split(',')[3]);
    const litSum = lit.circles.reduce((s, c) => s + alphaOf(c), 0);
    const shadowedSum = shadowed.circles.reduce((s, c) => s + alphaOf(c), 0);
    expect(shadowedSum).toBeLessThan(litSum);
  });
});
