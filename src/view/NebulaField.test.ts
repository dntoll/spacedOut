import { describe, expect, it, vi } from 'vitest';
import * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';
import { Camera } from './Camera';
import { NebulaField } from './NebulaField';
import { NebulaParticle } from './NebulaParticle';

const stubDrawing = (): { drawing: Drawing; circles: ReturnType<typeof vi.fn> } => {
  const circles = vi.fn();
  const drawing = {
    size: { width: 800, height: 600 },
    withAdditiveBlend: (fn: () => void) => fn(),
    circle,
  } as unknown as Drawing;
  function circle(position: Vec2, radius: number) { circles(position, radius); }
  return { drawing, circles };
};

const traversalModel = (shipPosition: Vec2 = { x: 0, y: 0 }): Model.Game =>
  ({
    mission: { isTraversal: true, signalDirection: { x: 1, y: 0 } },
    ship: { position: shipPosition },
    asteroidBelt: { forEachIsland: () => {} },
    pirateField: { forEachPirate: () => {} },
    droneField: { forEach: () => {} },
  }) as unknown as Model.Game;

describe('NebulaField', () => {
  it('REQ-67 draws gas-cloud particles during the second mission traversal', () => {
    const { drawing, circles } = stubDrawing();
    const field = new NebulaField();
    const camera = new Camera();
    camera.update({ x: 0, y: 0 }, 0, 1);

    field.update(0.016, traversalModel(), camera, { width: 800, height: 600 });
    field.draw(drawing);

    expect(circles).toHaveBeenCalled();
    const radius = circles.mock.calls[0][1];
    expect(radius).toBeGreaterThan(40);
  });

  it('REQ-67 draws nothing outside the traversal', () => {
    const { drawing, circles } = stubDrawing();
    const field = new NebulaField();
    const camera = new Camera();
    const model = { mission: { isTraversal: false, signalDirection: null }, ship: { position: { x: 0, y: 0 } } } as unknown as Model.Game;

    field.update(0.016, model, camera, { width: 800, height: 600 });
    field.draw(drawing);

    expect(circles).not.toHaveBeenCalled();
  });

  it('REQ-67 particles wisp out of the way when the ship drives through them', () => {
    const home = { x: 0, y: 0 };
    const particle = new NebulaParticle({ x: 0, y: 0 }, home, 80, { r: 180, g: 90, b: 220 }, 0.5);
    const shipPosition = { x: 60, y: 0 };

    particle.update(0.05, [shipPosition]);
    const beforeX = 0;
    expect(particle.position.x).toBeLessThan(beforeX);
  });

  it('REQ-67 particles spring back toward their home after the ship passes', () => {
    const home = { x: 0, y: 0 };
    const particle = new NebulaParticle({ x: 0, y: 0 }, home, 80, { r: 180, g: 90, b: 220 }, 0.5);

    particle.update(0.05, [{ x: 60, y: 0 }]);
    const pushedX = particle.position.x;
    for (let i = 0; i < 200; i++) particle.update(0.05, [{ x: 5000, y: 0 }]);

    expect(Math.abs(particle.position.x)).toBeLessThan(Math.abs(pushedX));
  });

  it('REQ-67 pirates and drones part the cloud just like the ship', () => {
    const home = { x: 0, y: 0 };
    const particle = new NebulaParticle({ x: 0, y: 0 }, home, 80, { r: 180, g: 90, b: 220 }, 0.5);

    particle.update(0.05, [{ x: 60, y: 0 }]);

    expect(particle.position.x).toBeLessThan(0);
  });

  it('REQ-67 clouds are large (triple area), spreading far across space', () => {
    const spy = vi.spyOn(Math, 'random')
      .mockImplementationOnce(() => 1.0)
      .mockImplementationOnce(() => 0.0)
      .mockImplementationOnce(() => 0.0)
      .mockImplementationOnce(() => 0.0)
      .mockImplementationOnce(() => 0.5);
    const { drawing, circles } = stubDrawing();
    const field = new NebulaField();
    const camera = new Camera();
    camera.update({ x: 0, y: 0 }, 0, 1);

    field.update(0.016, traversalModel(), camera, { width: 800, height: 600 });
    field.draw(drawing);
    spy.mockRestore();

    const xs = circles.mock.calls.map((c) => (c[0] as Vec2).x);
    const ys = circles.mock.calls.map((c) => (c[0] as Vec2).y);
    const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    expect(diagonal).toBeGreaterThan(3000);
  });

  it('REQ-67 clouds are dense, packing many particles into the cloud', () => {
    const { drawing, circles } = stubDrawing();
    const field = new NebulaField();
    const camera = new Camera();
    camera.update({ x: 0, y: 0 }, 0, 1);

    field.update(0.016, traversalModel(), camera, { width: 800, height: 600 });
    field.draw(drawing);

    expect(circles.mock.calls.length).toBeGreaterThanOrEqual(200);
  });

  it('REQ-67 defers to asteroid islands so nebulas and belts rarely co-occur', () => {
    const { drawing, circles } = stubDrawing();
    const field = new NebulaField();
    const camera = new Camera();
    camera.update({ x: 0, y: 0 }, 0, 1);
    const model = {
      mission: { isTraversal: true, signalDirection: { x: 1, y: 0 } },
      ship: { position: { x: 0, y: 0 } },
      asteroidBelt: {
        forEachIsland: (visitor: (island: { center: Vec2; radius: number; outline: Vec2[] }) => void) =>
          visitor({ center: { x: 0, y: 0 }, radius: 100000, outline: [] }),
      },
      pirateField: { forEachPirate: () => {} },
      droneField: { forEach: () => {} },
    } as unknown as Model.Game;

    field.update(0.016, model, camera, { width: 800, height: 600 });
    field.draw(drawing);

    expect(circles).not.toHaveBeenCalled();
  });

  it('REQ-67 spawns some clouds peripherally off the route so they frame the journey', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const { drawing, circles } = stubDrawing();
    const field = new NebulaField();
    const camera = new Camera();
    camera.update({ x: 0, y: 0 }, 0, 1);

    field.update(0.016, traversalModel(), camera, { width: 800, height: 600 });
    field.draw(drawing);
    spy.mockRestore();

    const ys = circles.mock.calls.map((c) => (c[0] as Vec2).y);
    expect(ys.every((y) => Math.abs(y) > 200)).toBe(true);
  });
});
