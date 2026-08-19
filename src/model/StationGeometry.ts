import type { Vec2 } from '../types';
import { add } from '../math';

export const rectangleVertices = (halfLength: number, halfWidth: number, samples = 24): number[] => {
  const vertices: number[] = [];
  for (let i = 0; i < samples; i++) {
    const angle = (i / samples) * Math.PI * 2;
    const c = Math.abs(Math.cos(angle));
    const s = Math.abs(Math.sin(angle));
    const along = c > 1e-6 ? halfLength / c : Number.POSITIVE_INFINITY;
    const across = s > 1e-6 ? halfWidth / s : Number.POSITIVE_INFINITY;
    const r = Math.min(along, across);
    vertices.push(r / halfLength);
  }
  return vertices;
};

export const pointOnCircle = (center: Vec2, radius: number, angle: number): Vec2 =>
  add(center, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
