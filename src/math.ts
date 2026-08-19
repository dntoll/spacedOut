import type { Vec2 } from './types';

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (v: Vec2, n: number): Vec2 => ({ x: v.x * n, y: v.y * n });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const length = (v: Vec2): number => Math.hypot(v.x, v.y);
export const normalize = (v: Vec2): Vec2 => {
  const l = length(v);
  return l > 0.0001 ? scale(v, 1 / l) : { x: 0, y: 0 };
};
export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
export const random = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
export const closestPointOnSegment = (point: Vec2, a: Vec2, b: Vec2): Vec2 => {
  const edge = sub(b, a);
  const amount = clamp(dot(sub(point, a), edge) / dot(edge, edge), 0, 1);
  return add(a, scale(edge, amount));
};
