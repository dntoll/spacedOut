import { describe, expect, it, vi } from 'vitest';
import * as Model from '../model';
import type { Drawing } from './Drawing';
import { StarLight } from './StarLight';
import { StationFixtures } from './StationFixtures';

describe('StationFixtures', () => {
  it('REQ-91 renders the shield-upgrade collectible as a distinct shield icon inside an azure glowing ring', () => {
    const station = new Model.Station();
    station.placeAt({ x: 0, y: 0 }, 3000, 0, 42);

    let pod: Model.ShieldPod | null = null;
    station.forEachCollectible((container) => {
      if (container instanceof Model.ShieldPod) pod = container as Model.ShieldPod;
    });
    expect(pod).not.toBeNull();

    const circles: { position: { x: number; y: number }; radius: number; stroke?: string }[] = [];
    const polygons: { points: { x: number; y: number }[]; stroke?: string }[] = [];
    const drawing = {
      withShadow: (_color: string, _blur: number, draw: () => void) => draw(),
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      circle: (position: { x: number; y: number }, radius: number, _fill: unknown, stroke?: string) =>
        circles.push({ position: { ...position }, radius, stroke }),
      polygon: (points: { x: number; y: number }[], _fill: unknown, stroke?: string) =>
        polygons.push({ points: points.map((p) => ({ ...p })), stroke }),
      line: vi.fn(),
    } as unknown as Drawing;

    new StationFixtures().drawGlowing(drawing, station, new StarLight(), 1);

    const ring = circles.find((c) => c.stroke === '#4d9fff' && c.radius === pod!.radius);
    expect(ring).toBeDefined();

    const icon = polygons.find((p) => p.stroke === '#4d9fff');
    expect(icon).toBeDefined();
    const xs = icon!.points.map((p) => p.x);
    const ys = icon!.points.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(20, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(26, 6);
  });
});
