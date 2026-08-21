import { describe, expect, it, vi } from 'vitest';
import * as Model from '../model';
import type { Drawing } from './Drawing';
import { Camera } from './Camera';
import { SeenMap } from './SeenMap';
import { gatherOccluderSegments } from './LineOfSight';
import { Minimap } from './Minimap';

// Drive the SeenMap the same way Game.ts does: rays from the ship out to the
// camera's visible radius, blocked by station walls/gates and massive asteroids.
function observeSeen(seen: SeenMap, model: Model.Game, camera: Camera, drawing: Drawing): void {
  const radius = camera.getVisibleWorldRadius(drawing.size);
  const station = (model as { station?: Model.Station }).station;
  const sig = station?.isPlaced
    ? `${station.isGateOpen(1)}:${station.isGateOpen(2)}:${station.isGateOpen(3)}`
    : '';
  const segs = gatherOccluderSegments(station ?? null, model.massiveAsteroidField, model.ship.position, radius);
  seen.update(model.ship.position, radius, segs, sig);
}

function makeDrawing(width = 1000, height = 700): Drawing {
  return {
    size: { width, height },
    rectangle: vi.fn(),
    circle: vi.fn(),
    polygon: vi.fn(),
    line: vi.fn(),
    fillPolygons: vi.fn(),
    dashedLine: vi.fn(),
    arc: vi.fn(),
    withClipRectangle: vi.fn((_position, _size, draw: () => void) => draw()),
    withTransform: vi.fn((_position, _angle, draw: () => void) => draw()),
  } as unknown as Drawing;
}

describe('Minimap', () => {
  it('REQ-23 shows seen space and discovered massive asteroids and collectables', () => {
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
    const seen = new SeenMap();
    const drawing = makeDrawing();
    const camera = new Camera();
    camera.update(ship.position, { x: 0, y: 0 }, 1);
    observeSeen(seen, model, camera, drawing);

    new Minimap().draw(drawing, seen, model, camera);

    // The small massive is fully within a seen cell, so its whole outline fills.
    expect(drawing.polygon).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })]),
      'rgba(90,112,132,.74)',
      'rgba(157,203,220,.82)',
      1,
    );
    expect(drawing.circle).toHaveBeenCalledWith(expect.any(Object), 2.2, '#5dff9a');
    expect(drawing.circle).toHaveBeenCalledWith(expect.any(Object), 1.6, 'rgba(146,164,186,.72)');
    expect(drawing.circle).toHaveBeenCalledWith(expect.any(Object), 2.0, '#5db8ff');
    // Fuel and ammo sit beyond the camera's visible radius, so they are not seen.
    expect(drawing.circle).not.toHaveBeenCalledWith(expect.any(Object), 2.2, '#ffc35c');
    expect(drawing.circle).not.toHaveBeenCalledWith(expect.any(Object), 2.2, '#c98bff');

    ship.position = { x: 1000, y: 0 };
    camera.update(ship.position, { x: 0, y: 0 }, 1);
    observeSeen(seen, model, camera, drawing);
    (drawing.circle as ReturnType<typeof vi.fn>).mockClear();
    new Minimap().draw(drawing, seen, model, camera);

    expect(drawing.circle).toHaveBeenCalledWith(expect.any(Object), 2.2, '#ffc35c');
    expect(drawing.circle).toHaveBeenCalledWith(expect.any(Object), 2.2, '#c98bff');
  });

  it('REQ-23 shows a large massive asteroid only as the seen portions of its outline', () => {
    const ship = new Model.Ship();
    // A realistically huge massive (30-100x ship radius) close enough that only
    // its near side falls within the camera's visible radius.
    const massive = new Model.MassiveAsteroid(
      1, { x: 1500, y: 0 }, 1200, 0, [1, 1, 1, 1], [], 0.5,
    );
    const model = {
      ship,
      supplyField: new Model.SupplyField({ x: 100000, y: 0 }, undefined, 1),
      massiveAsteroidField: new Model.MassiveAsteroidField(ship.position, ship.radius, [massive]),
      asteroidBelt: { forEach: () => undefined },
      droneField: { forEach: () => undefined },
      pirateField: { forEachPirate: () => {} },
      mission: { signalDirection: null },
    } as unknown as Model.Game;
    const seen = new SeenMap();
    const drawing = makeDrawing();
    const camera = new Camera();
    camera.update(ship.position, { x: 0, y: 0 }, 1);
    observeSeen(seen, model, camera, drawing);

    new Minimap().draw(drawing, seen, model, camera);

    // Not fully seen, so the filled polygon is NOT drawn...
    const drewFull = (drawing.polygon as ReturnType<typeof vi.fn>).mock.calls.some((call) =>
      call[1] === 'rgba(90,112,132,.74)' && call[2] === 'rgba(157,203,220,.82)');
    expect(drewFull).toBe(false);
    // ...but the seen near-side portions of the outline are stroked.
    const drewPartial = (drawing.line as ReturnType<typeof vi.fn>).mock.calls.some((call) =>
      call[2] === 'rgba(157,203,220,.82)');
    expect(drewPartial).toBe(true);
  });

  it('REQ-23 does not show a massive asteroid that has not been within camera range', () => {
    const ship = new Model.Ship();
    const massive = new Model.MassiveAsteroid(
      1, { x: 1500, y: 1500 }, 1200, 0, [1, 1, 1, 1], [], 0.5,
    );
    const model = {
      ship,
      supplyField: new Model.SupplyField({ x: 100000, y: 0 }, undefined, 1),
      massiveAsteroidField: new Model.MassiveAsteroidField(ship.position, ship.radius, [massive]),
      asteroidBelt: { forEach: () => undefined },
      droneField: { forEach: () => undefined },
      pirateField: { forEachPirate: () => {} },
      mission: { signalDirection: null },
    } as unknown as Model.Game;
    const seen = new SeenMap();
    const drawing = makeDrawing();
    const camera = new Camera();
    camera.update(ship.position, { x: 0, y: 0 }, 1);
    observeSeen(seen, model, camera, drawing);

    new Minimap().draw(drawing, seen, model, camera);

    const drewOutline = (drawing.polygon as ReturnType<typeof vi.fn>).mock.calls.some((call) =>
      call[1] === 'rgba(90,112,132,.74)');
    const drewPartial = (drawing.line as ReturnType<typeof vi.fn>).mock.calls.some((call) =>
      call[2] === 'rgba(157,203,220,.82)');
    expect(drewOutline).toBe(false);
    expect(drewPartial).toBe(false);
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
    const seen = new SeenMap();
    const drawing = makeDrawing();
    const camera = new Camera();
    camera.update(ship.position, { x: 0, y: 0 }, 1);
    // Pirate just outside the camera radius is not seen yet.
    pirate.position = { x: 2000, y: 0 };
    observeSeen(seen, model, camera, drawing);
    new Minimap().draw(drawing, seen, model, camera);
    expect(drawing.circle).not.toHaveBeenCalledWith(expect.any(Object), 2.6, '#ff6a4a');

    // Bring the pirate within camera range so the ship sees it.
    pirate.position = { x: 200, y: 0 };
    observeSeen(seen, model, camera, drawing);
    (drawing.circle as ReturnType<typeof vi.fn>).mockClear();
    new Minimap().draw(drawing, seen, model, camera);
    expect(drawing.circle).toHaveBeenCalledWith(expect.any(Object), 2.6, '#ff6a4a');
  });

  it('REQ-23 hides a collectable behind a massive asteroid until the ship moves around it', () => {
    const ship = new Model.Ship();
    const fuel = new Model.FuelContainer({ x: 1500, y: 0 });
    const supplyField = new Model.SupplyField({ x: 100000, y: 0 }, undefined, 1);
    supplyField.drop(fuel);
    const massive = new Model.MassiveAsteroid(
      1, { x: 600, y: 0 }, 400, 0, [1, 1, 1, 1], [], 0.5,
    );
    const model = {
      ship,
      supplyField,
      massiveAsteroidField: new Model.MassiveAsteroidField(ship.position, ship.radius, [massive]),
      asteroidBelt: { forEach: () => undefined },
      droneField: { forEach: () => undefined },
      pirateField: { forEachPirate: () => {} },
      mission: { signalDirection: null },
    } as unknown as Model.Game;
    const seen = new SeenMap();
    // A large viewport so the camera radius reaches past the massive.
    const drawing = makeDrawing(4000, 3000);
    const camera = new Camera();
    camera.update(ship.position, { x: 0, y: 0 }, 1);
    observeSeen(seen, model, camera, drawing);
    new Minimap().draw(drawing, seen, model, camera);
    expect(drawing.circle).not.toHaveBeenCalledWith(expect.any(Object), 2.2, '#ffc35c');

    // Move off-axis so the line of sight to the container clears the massive.
    ship.position = { x: 0, y: 800 };
    camera.update(ship.position, { x: 0, y: 0 }, 1);
    observeSeen(seen, model, camera, drawing);
    (drawing.circle as ReturnType<typeof vi.fn>).mockClear();
    new Minimap().draw(drawing, seen, model, camera);
    expect(drawing.circle).toHaveBeenCalledWith(expect.any(Object), 2.2, '#ffc35c');
  });

  it('REQ-60 enlarges the minimap world span during the mission 2 traversal', () => {
    const ship = new Model.Ship();
    ship.position = { x: 0, y: 0 };
    const asteroid = new Model.Asteroid(1, { x: 300, y: 0 }, { x: 0, y: 0 }, 24, 0, 0, [1, 1, 1], 0.5);
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
    const seen = new SeenMap();
    const drawing = makeDrawing();
    const camera = new Camera();
    camera.update(ship.position, { x: 0, y: 0 }, 1);
    observeSeen(seen, buildModel(false), camera, drawing);

    new Minimap().draw(drawing, seen, buildModel(false), camera);
    const nonTraversalCalls = (drawing.circle as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[1] === 1.6 && call[2] === 'rgba(146,164,186,.72)',
    );
    expect(nonTraversalCalls.length).toBeGreaterThan(0);
    const nonTraversalX = (nonTraversalCalls[0][0] as { x: number }).x;

    (drawing.circle as ReturnType<typeof vi.fn>).mockClear();
    observeSeen(seen, buildModel(true), camera, drawing);
    new Minimap().draw(drawing, seen, buildModel(true), camera);
    const traversalCalls = (drawing.circle as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[1] === 1.6 && call[2] === 'rgba(146,164,186,.72)',
    );
    expect(traversalCalls.length).toBeGreaterThan(0);
    const traversalX = (traversalCalls[0][0] as { x: number }).x;

    // Wider span pulls the seen asteroid closer to the map center.
    const mapCenterX = drawing.size.width - 180 - 40 + 90;
    expect(Math.abs(traversalX - mapCenterX)).toBeLessThan(Math.abs(nonTraversalX - mapCenterX));
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
      mission: { signalDirection: { x: 1, y: 0 }, showDirectionalSignal: true },
      elapsed: 0.5,
    } as unknown as Model.Game;
    const seen = new SeenMap();
    const drawing = makeDrawing();
    const camera = new Camera();
    camera.update(ship.position, { x: 0, y: 0 }, 1);
    observeSeen(seen, model, camera, drawing);

    new Minimap().draw(drawing, seen, model, camera);

    const dashedLine = drawing.dashedLine as ReturnType<typeof vi.fn>;
    expect(dashedLine).toHaveBeenCalledTimes(1);
    const [from, to, color] = dashedLine.mock.calls[0];
    expect(color).toBe('#ff3b3b');
    expect(to.x).toBeGreaterThan(from.x);
    expect(to.y).toBeCloseTo(from.y, 6);

    const arc = drawing.arc as ReturnType<typeof vi.fn>;
    expect(arc).toHaveBeenCalled();
    for (const call of arc.mock.calls) {
      const arcColor = call[4];
      expect(arcColor).toMatch(/^rgba\(255,59,59,/);
    }
  });

  it('REQ-76 hides the minimap signal during mission 3', () => {
    const ship = new Model.Ship();
    const model = {
      ship,
      supplyField: new Model.SupplyField({ x: 100000, y: 0 }, undefined, 1),
      massiveAsteroidField: new Model.MassiveAsteroidField(ship.position, ship.radius, []),
      asteroidBelt: { forEach: () => undefined },
      droneField: { forEach: () => undefined },
      pirateField: { forEachPirate: () => {} },
      mission: { signalDirection: { x: 1, y: 0 }, showDirectionalSignal: false },
      elapsed: 0.5,
    } as unknown as Model.Game;
    const seen = new SeenMap();
    const drawing = makeDrawing();
    const camera = new Camera();
    camera.update(ship.position, { x: 0, y: 0 }, 1);
    observeSeen(seen, model, camera, drawing);

    new Minimap().draw(drawing, seen, model, camera);

    const dashedLine = drawing.dashedLine as ReturnType<typeof vi.fn>;
    const redLines = dashedLine.mock.calls.filter((call) => call[2] === '#ff3b3b');
    expect(redLines).toHaveLength(0);
    const arc = drawing.arc as ReturnType<typeof vi.fn>;
    const redArcs = arc.mock.calls.filter((call) => typeof call[4] === 'string' && call[4].startsWith('rgba(255,59,59,'));
    expect(redArcs).toHaveLength(0);
  });

  it('REQ-81 hides the station on the minimap until the ship sees it, then shows seen parts', () => {
    const ship = new Model.Ship();
    const station = new Model.Station();
    station.placeAt({ x: 0, y: 0 }, 3000, 0, 42);
    const model = {
      ship,
      supplyField: new Model.SupplyField({ x: 100000, y: 0 }, undefined, 1),
      massiveAsteroidField: new Model.MassiveAsteroidField(ship.position, ship.radius, []),
      asteroidBelt: { forEach: () => undefined },
      droneField: { forEach: () => undefined },
      pirateField: { forEachPirate: () => {} },
      mission: { signalDirection: null, isTraversal: false },
      station,
      elapsed: 0,
    } as unknown as Model.Game;
    const seen = new SeenMap();
    const drawing = makeDrawing(10000, 10000);
    const camera = new Camera();

    // Ship far outside the station: nothing is within camera range, so nothing
    // of the station is drawn — no hull disc, no walls, no gates, no switches.
    ship.position = { x: 10000, y: 0 };
    camera.update(ship.position, { x: 0, y: 0 }, 1);
    observeSeen(seen, model, camera, drawing);
    new Minimap().draw(drawing, seen, model, camera);
    const circle = drawing.circle as ReturnType<typeof vi.fn>;
    const line = drawing.line as ReturnType<typeof vi.fn>;
    expect(circle.mock.calls.some((call) => call[2] === '#0c0c0e')).toBe(false);
    expect(line.mock.calls.some((call) => call[2] === 'rgba(58,58,64,.5)')).toBe(false);
    expect(circle.mock.calls.some((call) => call[2] === '#e8923a')).toBe(false);
    expect(circle.mock.calls.some((call) => call[2] === '#5de0ff')).toBe(false);

    // Move the ship to a gate so it has line of sight to it; the gate appears.
    let gatePosition: { x: number; y: number } = { x: 0, y: 0 };
    station.forEachGate((gate) => { gatePosition = { ...gate.position }; });
    ship.position = { ...gatePosition };
    camera.update(ship.position, { x: 0, y: 0 }, 1);
    observeSeen(seen, model, camera, drawing);
    circle.mockClear();
    line.mockClear();
    new Minimap().draw(drawing, seen, model, camera);
    expect(circle.mock.calls.some((call) => call[2] === '#e8923a')).toBe(true);
    // The opaque hull disc is never drawn now (only seen wall portions).
    expect(circle.mock.calls.some((call) => call[2] === '#0c0c0e')).toBe(false);
  });
});
