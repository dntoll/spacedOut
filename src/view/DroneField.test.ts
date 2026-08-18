import { describe, expect, it } from 'vitest';
import { Drone } from '../model/Drone';
import type { DroneField as ModelDroneField, Ship as ModelShip } from '../model';
import type { Drawing, RadialPaint } from './Drawing';
import { DroneField } from './DroneField';

interface ArcCall { position: { x: number; y: number }; radius: number; }

const createDrawing = (arcs: ArcCall[]) => ({
  size: { width: 1000, height: 700 },
  withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
  withShadow: (_color: string, _blur: number, draw: () => void) => draw(),
  polygon: () => {},
  line: () => {},
  arc: (position: { x: number; y: number }, radius: number) => arcs.push({ position: { ...position }, radius }),
}) as unknown as Drawing;

const stubShip = (radius: number): ModelShip => ({ position: { x: 0, y: 0 }, radius } as never);
const stubField = (drones: Drone[], hunting: boolean, detach: number, giveUp: number): ModelDroneField => ({
  forEach: (fn: (d: Drone) => void) => drones.forEach(fn),
  anyHunting: () => hunting,
  detachRange: () => detach,
  giveUpRadius: () => giveUp,
}) as never;

describe('DroneField view', () => {
  it('REQ-49 draws a blue irregular body with gripping arms on one side', () => {
    const polygons: Array<{ points: Array<{ x: number; y: number }>; fill: RadialPaint }> = [];
    const lines: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = [];
    const drawing = {
      size: { width: 1000, height: 700 },
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      withShadow: (_color: string, _blur: number, draw: () => void) => draw(),
      polygon: (points: Array<{ x: number; y: number }>, fill: RadialPaint) => polygons.push({ points, fill }),
      line: (from: { x: number; y: number }, to: { x: number; y: number }) => lines.push({ from, to }),
      arc: () => {},
    } as unknown as Drawing;
    const drone = new Drone(null, 0, [0.8, 1.1, 0.9, 1.2, 0.85], 2);

    new DroneField().draw(
      drawing,
      stubField([drone], true, 216, 1200),
      stubShip(18),
      { zoom: 1 } as never,
    );

    expect(polygons).toHaveLength(1);
    expect(polygons[0].points.length).toBe(drone.vertices.length);
    const blue = polygons[0].fill.stops.some((stop) => stop.color === '#3a8fd6' || stop.color === '#8accff');
    expect(blue).toBe(true);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const radius = drone.radius;
    expect(lines.every((line) => line.to.x > radius * 0.8)).toBe(true);
  });

  it('REQ-57 draws a detection ring around an attached drone at the detach range', () => {
    const host = { position: { x: 0, y: 0 }, radius: 30 } as never;
    const attached = new Drone(host, 0, [1, 1, 1], 2);
    attached.position = { x: 300, y: 0 };
    const arcs: ArcCall[] = [];
    const ship = stubShip(18);

    new DroneField().draw(createDrawing(arcs), stubField([attached], false, 216, 1200), ship, { zoom: 1 } as never);

    const detection = arcs.find((a) => Math.abs(a.radius - 216) < 1);
    expect(detection).toBeDefined();
    expect(detection!.position).toEqual({ x: 300, y: 0 });
  });

  it('REQ-57 draws no detection ring for a hunting drone', () => {
    const hunter = new Drone(null, 0, [1, 1, 1], 2);
    hunter.position = { x: 300, y: 0 };
    const arcs: ArcCall[] = [];

    new DroneField().draw(createDrawing(arcs), stubField([hunter], true, 216, 1200), stubShip(18), { zoom: 1 } as never);

    const detection = arcs.find((a) => Math.abs(a.radius - 216) < 1);
    expect(detection).toBeUndefined();
  });

  it('REQ-59 draws an escape ring around the ship at the give-up radius while any drone is hunting', () => {
    const hunter = new Drone(null, 0, [1, 1, 1], 2);
    hunter.position = { x: 300, y: 0 };
    const arcs: ArcCall[] = [];

    new DroneField().draw(createDrawing(arcs), stubField([hunter], true, 216, 1200), stubShip(18), { zoom: 1 } as never);

    const escape = arcs.find((a) => Math.abs(a.radius - 1200) < 1);
    expect(escape).toBeDefined();
    expect(escape!.position).toEqual({ x: 0, y: 0 });
  });

  it('REQ-59 draws no escape ring when no drones are hunting', () => {
    const host = { position: { x: 0, y: 0 }, radius: 30 } as never;
    const attached = new Drone(host, 0, [1, 1, 1], 2);
    attached.position = { x: 300, y: 0 };
    const arcs: ArcCall[] = [];

    new DroneField().draw(createDrawing(arcs), stubField([attached], false, 216, 1200), stubShip(18), { zoom: 1 } as never);

    const escape = arcs.find((a) => Math.abs(a.radius - 1200) < 1);
    expect(escape).toBeUndefined();
  });
});
