import { afterEach, describe, expect, it, vi } from 'vitest';
import { Drawing } from './Drawing';

describe('Drawing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('REQ-01 creates and renders to a Canvas drawing surface', () => {
    const context = { setTransform: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
    const canvas = { getContext: vi.fn(() => context), style: {}, width: 0, height: 0 };
    vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600, devicePixelRatio: 2 });
    vi.stubGlobal('document', { querySelector: vi.fn(() => canvas) });

    const drawing = new Drawing('#game');
    drawing.clear('#04070f');

    expect(canvas.getContext).toHaveBeenCalledWith('2d');
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
  });
});
