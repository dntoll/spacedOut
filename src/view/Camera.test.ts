import { describe, expect, it, vi } from 'vitest';
import type { Drawing } from './Drawing';
import { Camera } from './Camera';

describe('Camera', () => {
  it('REQ-03 centers the world transform on the ship', () => {
    const camera = new Camera();
    const withCamera = vi.fn((_position, _zoom, draw: () => void) => draw());
    const drawing = { withCamera } as unknown as Drawing;
    camera.update({ x: 120, y: -40 }, 0, 1);

    camera.drawWorld(drawing, vi.fn());

    expect(withCamera).toHaveBeenCalledWith({ x: 120, y: -40 }, camera.zoom, expect.any(Function));
  });

  it('REQ-09 zooms farther out at higher ship speeds', () => {
    const slow = new Camera();
    const fast = new Camera();
    slow.update({ x: 0, y: 0 }, 0, 1);
    fast.update({ x: 0, y: 0 }, 600, 1);
    expect(fast.zoom).toBeLessThan(slow.zoom);
  });
});
