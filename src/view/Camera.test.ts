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

  it('REQ-50 tunes the resting zoom from the default zoom-in level setting', () => {
    const close = new Camera();
    close.setBaseZoom(1.5);
    close.update({ x: 0, y: 0 }, 0, 1);
    const far = new Camera();
    far.setBaseZoom(0.6);
    far.update({ x: 0, y: 0 }, 0, 1);

    expect(close.zoom).toBeGreaterThan(far.zoom);

    const fast = new Camera();
    fast.setBaseZoom(1.5);
    fast.update({ x: 0, y: 0 }, 600, 1);
    expect(fast.zoom).toBeLessThan(close.zoom);
  });

  it('REQ-23 exposes the camera-visible world bounds for exploration', () => {
    const camera = new Camera();
    camera.update({ x: 100, y: 50 }, 0, 1);

    const bounds = camera.getVisibleWorldBounds({ width: 230, height: 115 });

    expect(bounds.left).toBeCloseTo(0);
    expect(bounds.top).toBeCloseTo(0);
    expect(bounds.right).toBeCloseTo(200);
    expect(bounds.bottom).toBeCloseTo(100);
  });

  it('REQ-25 exposes the zoomed visible radius for offscreen spawning', () => {
    const slow = new Camera();
    const fast = new Camera();
    slow.update({ x: 0, y: 0 }, 0, 1);
    fast.update({ x: 0, y: 0 }, 600, 1);

    expect(fast.getVisibleWorldRadius({ width: 1000, height: 600 }))
      .toBeGreaterThan(slow.getVisibleWorldRadius({ width: 1000, height: 600 }));
  });

  it('REQ-56 zooms farther out while any drone is hunting', () => {
    const calm = new Camera();
    const threatened = new Camera();
    calm.update({ x: 0, y: 0 }, 0, 1, false);
    threatened.update({ x: 0, y: 0 }, 0, 1, true);

    expect(threatened.zoom).toBeLessThan(calm.zoom);

    const fastCalm = new Camera();
    const fastThreatened = new Camera();
    fastCalm.update({ x: 0, y: 0 }, 600, 1, false);
    fastThreatened.update({ x: 0, y: 0 }, 600, 1, true);
    expect(fastThreatened.zoom).toBeLessThan(fastCalm.zoom);
  });

  it('REQ-56 eases back in when the drone threat clears', () => {
    const camera = new Camera();
    camera.update({ x: 0, y: 0 }, 0, 1, true);
    const threatenedZoom = camera.zoom;

    camera.update({ x: 0, y: 0 }, 0, 1, false);

    expect(camera.zoom).toBeGreaterThan(threatenedZoom);
  });
});
