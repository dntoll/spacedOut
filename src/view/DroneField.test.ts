import { describe, expect, it, vi } from 'vitest';
import { Drone } from '../model/Drone';
import type { Drawing, RadialPaint } from './Drawing';
import { DroneField } from './DroneField';

describe('DroneField view', () => {
  it('REQ-49 draws a green irregular body with gripping arms on one side', () => {
    const polygons: Array<{ points: Array<{ x: number; y: number }>; fill: RadialPaint }> = [];
    const lines: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = [];
    const drawing = {
      size: { width: 1000, height: 700 },
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      withShadow: (_color: string, _blur: number, draw: () => void) => draw(),
      polygon: (points: Array<{ x: number; y: number }>, fill: RadialPaint) => polygons.push({ points, fill }),
      line: (from: { x: number; y: number }, to: { x: number; y: number }) => lines.push({ from, to }),
    } as unknown as Drawing;
    const drone = new Drone(null, 0, [0.8, 1.1, 0.9, 1.2, 0.85], 2);

    new DroneField().draw(
      drawing,
      { forEach: (fn: (d: Drone) => void) => fn(drone) } as never,
      { x: 0, y: 0 },
      { zoom: 1 } as never,
    );

    expect(polygons).toHaveLength(1);
    expect(polygons[0].points.length).toBe(drone.vertices.length);
    const green = polygons[0].fill.stops.some((stop) => stop.color === '#3fae3a' || stop.color === '#b6ff8a');
    expect(green).toBe(true);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const radius = drone.radius;
    expect(lines.every((line) => line.to.x > radius * 0.8)).toBe(true);
  });
});
