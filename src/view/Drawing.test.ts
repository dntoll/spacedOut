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

  it('REQ-39 strokes a line between two points for laser beams', () => {
    const context = {
      setTransform: vi.fn(), fillRect: vi.fn(), fillStyle: '',
      beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      strokeStyle: '', lineWidth: 0, lineCap: '',
    };
    const canvas = { getContext: vi.fn(() => context), style: {}, width: 0, height: 0 };
    vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 });
    vi.stubGlobal('document', { querySelector: vi.fn(() => canvas) });

    const drawing = new Drawing('#game');
    drawing.line({ x: 10, y: 10 }, { x: 40, y: 10 }, '#ff3b4d', 3);

    expect(context.beginPath).toHaveBeenCalled();
    expect(context.moveTo).toHaveBeenCalledWith(10, 10);
    expect(context.lineTo).toHaveBeenCalledWith(40, 10);
    expect(context.strokeStyle).toBe('#ff3b4d');
    expect(context.lineWidth).toBe(3);
    expect(context.stroke).toHaveBeenCalled();
  });

  it('REQ-56 strokes a dashed line between two points for the signal indicator', () => {
    const context = {
      setTransform: vi.fn(), fillRect: vi.fn(), fillStyle: '',
      save: vi.fn(), restore: vi.fn(),
      beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      strokeStyle: '', lineWidth: 0, lineCap: '',
      setLineDash: vi.fn(),
    };
    const canvas = { getContext: vi.fn(() => context), style: {}, width: 0, height: 0 };
    vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 });
    vi.stubGlobal('document', { querySelector: vi.fn(() => canvas) });

    const drawing = new Drawing('#game');
    drawing.dashedLine({ x: 10, y: 10 }, { x: 40, y: 10 }, '#ff3b3b', 3);

    expect(context.moveTo).toHaveBeenCalledWith(10, 10);
    expect(context.lineTo).toHaveBeenCalledWith(40, 10);
    expect(context.strokeStyle).toBe('#ff3b3b');
    expect(context.setLineDash).toHaveBeenCalledWith([7, 6]);
    expect(context.stroke).toHaveBeenCalled();
    expect(context.save).toHaveBeenCalled();
    expect(context.restore).toHaveBeenCalled();
  });

  it('REQ-56 strokes a partial arc for the radio-wave indicator', () => {
    const context = {
      setTransform: vi.fn(), fillRect: vi.fn(), fillStyle: '',
      save: vi.fn(), restore: vi.fn(),
      beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(),
      strokeStyle: '', lineWidth: 0,
    };
    const canvas = { getContext: vi.fn(() => context), style: {}, width: 0, height: 0 };
    vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 });
    vi.stubGlobal('document', { querySelector: vi.fn(() => canvas) });

    const drawing = new Drawing('#game');
    drawing.arc({ x: 400, y: 300 }, 50, 0, Math.PI, 'rgba(255,59,59,0.5)', 2);

    expect(context.arc).toHaveBeenCalledWith(400, 300, 50, 0, Math.PI);
    expect(context.strokeStyle).toBe('rgba(255,59,59,0.5)');
    expect(context.lineWidth).toBe(2);
    expect(context.stroke).toHaveBeenCalled();
  });
});
