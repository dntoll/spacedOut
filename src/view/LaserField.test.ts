import { describe, expect, it, vi } from 'vitest';
import * as Model from '../model';
import type { Drawing } from './Drawing';
import { LaserField as LaserFieldView } from './LaserField';

describe('LaserField view', () => {
  it('REQ-39 renders each laser as a red forward beam', () => {
    const lines: Array<{ from: unknown; to: unknown; color: string; width: number }> = [];
    const drawing = {
      withAdditiveBlend: (fn: () => void) => fn(),
      withShadow: (_color: string, _blur: number, fn: () => void) => fn(),
      line: (from: unknown, to: unknown, color: string, width: number) => lines.push({ from, to, color, width }),
    } as unknown as Drawing;

    const ship = new Model.Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    const field = new Model.LaserField();
    field.fire(ship);

    new LaserFieldView().draw(drawing, field);

    expect(lines).toHaveLength(1);
    expect(lines[0].color).toMatch(/ff/i);
    expect(lines[0].width).toBeGreaterThan(0);
  });

  it('REQ-39 draws nothing when no lasers are active', () => {
    const lines: unknown[] = [];
    const drawing = {
      withAdditiveBlend: (fn: () => void) => fn(),
      withShadow: (_color: string, _blur: number, fn: () => void) => fn(),
      line: () => lines.push({}),
    } as unknown as Drawing;

    new LaserFieldView().draw(drawing, new Model.LaserField());

    expect(lines).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});
