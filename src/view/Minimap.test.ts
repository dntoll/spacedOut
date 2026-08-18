import { describe, expect, it, vi } from 'vitest';
import * as Model from '../model';
import type { Drawing } from './Drawing';
import { Camera } from './Camera';
import { ExplorationMap } from './ExplorationMap';
import { Minimap } from './Minimap';

describe('Minimap', () => {
  it('REQ-23 shows explored space and discovered massive asteroids and collectables', () => {
    const ship = new Model.Ship();
    const hp = new Model.HpContainer({ x: -100, y: 100 });
    const fuel = new Model.FuelContainer({ x: 1000, y: 0 });
    const ammo = new Model.AmmoContainer({ x: 1000, y: 100 });
    const supplyField = new Model.SupplyField({ x: 100000, y: 0 }, undefined, 1);
    supplyField.drop(hp);
    supplyField.drop(fuel);
    supplyField.drop(ammo);
    const massive = new Model.MassiveAsteroid(
      1, { x: -100, y: 0 }, 50, 0, [1, 1, 1, 1], [], 0.5,
    );
    const asteroid = new Model.Asteroid(1, { x: 200, y: 0 }, { x: 0, y: 0 }, 24, 0, 0, [1, 1, 1], 0.5);
    const drone = new Model.Drone(null, 0, [1, 1, 1], 2);
    const model = {
      ship,
      supplyField,
      massiveAsteroidField: new Model.MassiveAsteroidField(ship.position, ship.radius, [massive]),
      asteroidBelt: { forEach: (fn: (a: Model.Asteroid) => void) => fn(asteroid) },
      droneField: { forEach: (fn: (d: Model.Drone) => void) => fn(drone) },
      pirateField: { forEachPirate: () => {} },
      mission: { signalDirection: null },
    } as unknown as Model.Game;
    const exploration = new ExplorationMap();
    exploration.observe({ left: -250, top: -250, right: 250, bottom: 250 });
    const circle = vi.fn();
    const polygon = vi.fn();
    const dashedLine = vi.fn();
    const arc = vi.fn();
    const withTransform = vi.fn((_position, _angle, draw: () => void) => draw());
    const drawing = {
      size: { width: 1000, height: 700 },
      rectangle: vi.fn(),
      circle,
      polygon,
      dashedLine,
      arc,
      withClipRectangle: vi.fn((_position, _size, draw: () => void) => draw()),
      withTransform,
    } as unknown as Drawing;
    const camera = new Camera();
    camera.update(ship.position, 0, 1);

    new Minimap().draw(drawing, exploration, model, camera);

    expect(polygon).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })]),
      'rgba(90,112,132,.74)',
      'rgba(157,203,220,.82)',
      1,
    );
    expect(circle).toHaveBeenCalledWith(expect.any(Object), 2.2, '#5dff9a');
    expect(circle).toHaveBeenCalledWith(expect.any(Object), 1.6, 'rgba(146,164,186,.72)');
    expect(circle).toHaveBeenCalledWith(expect.any(Object), 2.0, '#7dff5e');
    expect(circle).not.toHaveBeenCalledWith(expect.any(Object), 2.2, '#ffc35c');
    expect(circle).not.toHaveBeenCalledWith(expect.any(Object), 2.2, '#c98bff');
    expect(withTransform).toHaveBeenCalledWith({ x: 870, y: 162 }, ship.angle, expect.any(Function));

    ship.position = { x: 1000, y: 0 };
    camera.update(ship.position, 0, 1);
    exploration.observe(camera.getVisibleWorldBounds(drawing.size));
    circle.mockClear();
    withTransform.mockClear();
    new Minimap().draw(drawing, exploration, model, camera);

    expect(circle).toHaveBeenCalledWith(expect.any(Object), 2.2, '#ffc35c');
    expect(circle).toHaveBeenCalledWith(expect.any(Object), 2.2, '#c98bff');
    expect(withTransform).toHaveBeenCalledWith({ x: 870, y: 162 }, ship.angle, expect.any(Function));
  });

  it('REQ-56 draws a dotted red signal line and a red growing-arc wave on the minimap', () => {
    const ship = new Model.Ship();
    const drone = new Model.Drone(null, 0, [1, 1, 1], 2);
    drone.position = { x: 100000, y: 0 };
    const model = {
      ship,
      supplyField: new Model.SupplyField({ x: 100000, y: 0 }, undefined, 1),
      massiveAsteroidField: new Model.MassiveAsteroidField(ship.position, ship.radius, []),
      asteroidBelt: { forEach: () => undefined },
      droneField: { forEach: (fn: (d: Model.Drone) => void) => fn(drone) },
      pirateField: { forEachPirate: () => {} },
      mission: { signalDirection: { x: 1, y: 0 } },
      elapsed: 0.5,
    } as unknown as Model.Game;
    const exploration = new ExplorationMap();
    const dashedLine = vi.fn();
    const arc = vi.fn();
    const drawing = {
      size: { width: 1000, height: 700 },
      rectangle: vi.fn(),
      circle: vi.fn(),
      polygon: vi.fn(),
      dashedLine,
      arc,
      withClipRectangle: vi.fn((_position, _size, draw: () => void) => draw()),
      withTransform: vi.fn((_position, _angle, draw: () => void) => draw()),
    } as unknown as Drawing;
    const camera = new Camera();
    camera.update(ship.position, 0, 1);

    new Minimap().draw(drawing, exploration, model, camera);

    expect(dashedLine).toHaveBeenCalledTimes(1);
    const [from, to, color] = dashedLine.mock.calls[0];
    expect(color).toBe('#ff3b3b');
    expect(to.x).toBeGreaterThan(from.x);
    expect(to.y).toBeCloseTo(from.y, 6);

    expect(arc).toHaveBeenCalled();
    for (const call of arc.mock.calls) {
      const arcColor = call[4];
      expect(arcColor).toMatch(/^rgba\(255,59,59,/);
    }
  });

  it('REQ-60 enlarges the minimap world span during the mission 2 traversal', () => {
    const ship = new Model.Ship();
    ship.position = { x: 0, y: 0 };
    const asteroid = new Model.Asteroid(1, { x: 6000, y: 0 }, { x: 0, y: 0 }, 24, 0, 0, [1, 1, 1], 0.5);
    const buildModel = (isTraversal: boolean) => ({
      ship,
      supplyField: new Model.SupplyField({ x: 100000, y: 0 }, undefined, 1),
      massiveAsteroidField: new Model.MassiveAsteroidField(ship.position, ship.radius, []),
      asteroidBelt: { forEach: (fn: (a: Model.Asteroid) => void) => fn(asteroid) },
      droneField: { forEach: () => undefined },
      pirateField: { forEachPirate: () => {} },
      mission: { signalDirection: null, isTraversal },
      elapsed: 0,
    } as unknown as Model.Game);
    const exploration = new ExplorationMap();
    exploration.observe({ left: 5800, top: -100, right: 6200, bottom: 100 });
    const camera = new Camera();
    camera.update(ship.position, 0, 1);

    const drawing = {
      size: { width: 1000, height: 700 },
      rectangle: vi.fn(),
      circle: vi.fn(),
      polygon: vi.fn(),
      dashedLine: vi.fn(),
      arc: vi.fn(),
      withClipRectangle: vi.fn((_position, _size, draw: () => void) => draw()),
      withTransform: vi.fn((_position, _angle, draw: () => void) => draw()),
    } as unknown as Drawing;

    new Minimap().draw(drawing, exploration, buildModel(false), camera);
    expect(drawing.circle).not.toHaveBeenCalledWith(expect.any(Object), 1.6, 'rgba(146,164,186,.72)');

    (drawing.circle as ReturnType<typeof vi.fn>).mockClear();
    new Minimap().draw(drawing, exploration, buildModel(true), camera);
    expect(drawing.circle).toHaveBeenCalledWith(expect.any(Object), 1.6, 'rgba(146,164,186,.72)');
  });

  it('REQ-23 shows discovered pirate ships on the minimap', () => {
    const ship = new Model.Ship();
    const pirate = new Model.Pirate({ x: 200, y: 0 }, [1, 1, 1], 3);
    const model = {
      ship,
      supplyField: new Model.SupplyField({ x: 100000, y: 0 }, undefined, 1),
      massiveAsteroidField: new Model.MassiveAsteroidField(ship.position, ship.radius, []),
      asteroidBelt: { forEach: () => undefined },
      droneField: { forEach: () => undefined },
      pirateField: { forEachPirate: (fn: (p: Model.Pirate) => void) => fn(pirate) },
      mission: { signalDirection: null },
      elapsed: 0,
    } as unknown as Model.Game;
    const exploration = new ExplorationMap();
    const camera = new Camera();
    camera.update(ship.position, 0, 1);
    const drawing = {
      size: { width: 1000, height: 700 },
      rectangle: vi.fn(),
      circle: vi.fn(),
      polygon: vi.fn(),
      dashedLine: vi.fn(),
      arc: vi.fn(),
      withClipRectangle: vi.fn((_position: unknown, _size: unknown, draw: () => void) => draw()),
      withTransform: vi.fn((_position: unknown, _angle: unknown, draw: () => void) => draw()),
    } as unknown as Drawing;

    new Minimap().draw(drawing, exploration, model, camera);
    expect(drawing.circle).not.toHaveBeenCalledWith(expect.any(Object), 2.6, '#ff6a4a');

    exploration.observe({ left: -250, top: -250, right: 250, bottom: 250 });
    (drawing.circle as ReturnType<typeof vi.fn>).mockClear();
    new Minimap().draw(drawing, exploration, model, camera);
    expect(drawing.circle).toHaveBeenCalledWith(expect.any(Object), 2.6, '#ff6a4a');
  });
});
