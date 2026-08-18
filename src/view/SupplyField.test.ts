import { describe, expect, it, vi } from 'vitest';
import { SupplyField as ModelSupplyField } from '../model/SupplyField';
import { WeaponPod } from '../model/WeaponPod';
import type { Drawing } from './Drawing';
import { StarLight } from './StarLight';
import { SupplyField } from './SupplyField';

describe('SupplyField view', () => {
  it('REQ-69 renders a weapon pod as a distinct blaster polygon inside a glowing ring, larger than the round containers', () => {
    const polygons: Array<{ x: number; y: number }[]> = [];
    const circles: Array<{ position: { x: number; y: number }; radius: number }> = [];
    const drawing = {
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      withShadow: (_color: string, _blur: number, draw: () => void) => draw(),
      polygon: (points: { x: number; y: number }[]) => polygons.push(points),
      circle: (position: { x: number; y: number }, radius: number) => circles.push({ position: { ...position }, radius }),
      line: vi.fn(),
    } as unknown as Drawing;

    const pod = new WeaponPod({ x: 0, y: 0 });
    const field = new ModelSupplyField({ x: 0, y: 0 }, [pod]);

    new SupplyField().draw(drawing, field, new StarLight(), null);

    const ring = circles.find((c) => c.position.x === 0 && c.position.y === 0 && c.radius === pod.radius);
    expect(ring).toBeDefined();

    expect(polygons.length).toBeGreaterThan(0);
    const blaster = polygons[0];
    const xs = blaster.map((p) => p.x);
    const ys = blaster.map((p) => p.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    expect(width).toBeGreaterThan(26);
    expect(height).toBeGreaterThan(18);
  });
});
