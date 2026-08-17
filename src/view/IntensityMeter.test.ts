import { describe, expect, it, vi } from 'vitest';
import type { Drawing } from './Drawing';
import { IntensityMeter } from './IntensityMeter';

function stubDrawing(): { drawing: Drawing; rectangle: ReturnType<typeof vi.fn>; line: ReturnType<typeof vi.fn> } {
  const rectangle = vi.fn();
  const line = vi.fn();
  const drawing = {
    rectangle,
    line,
    withClipRectangle: (_p: unknown, _s: unknown, draw: () => void) => draw(),
  } as unknown as Drawing;
  return { drawing, rectangle, line };
}

describe('IntensityMeter', () => {
  it('REQ-46 draws an intensity fill colored by the active category', () => {
    const { drawing, rectangle } = stubDrawing();
    const thresholds = { medium: 0.25, action: 0.6 };

    new IntensityMeter().draw(drawing, 0.7, thresholds, 'action', { width: 1000, height: 700 });

    expect(rectangle).toHaveBeenCalledWith(
      expect.objectContaining({ y: 80 }),
      expect.objectContaining({ height: 8 }),
      '#ff5c6c',
    );
  });

  it('REQ-46 marks the medium and action thresholds as ticks', () => {
    const { drawing, line } = stubDrawing();
    const thresholds = { medium: 0.25, action: 0.6 };

    new IntensityMeter().draw(drawing, 0.3, thresholds, 'medium', { width: 1000, height: 700 });

    expect(line).toHaveBeenCalledWith(
      expect.objectContaining({ y: 77 }),
      expect.objectContaining({ y: 91 }),
      'rgba(255,195,92,.9)',
      1.5,
    );
    expect(line).toHaveBeenCalledWith(
      expect.objectContaining({ y: 77 }),
      expect.objectContaining({ y: 91 }),
      'rgba(255,92,108,.9)',
      1.5,
    );
  });

  it('REQ-46 draws a needle at the current intensity position', () => {
    const { drawing, line } = stubDrawing();
    const thresholds = { medium: 0.25, action: 0.6 };

    new IntensityMeter().draw(drawing, 0.5, thresholds, 'medium', { width: 1000, height: 700 });

    expect(line).toHaveBeenCalledWith(
      expect.objectContaining({ y: 78 }),
      expect.objectContaining({ y: 90 }),
      '#ebfbff',
      2,
    );
  });
});
