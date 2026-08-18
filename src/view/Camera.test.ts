import { describe, expect, it, vi } from 'vitest';
import type { Drawing } from './Drawing';
import { Camera } from './Camera';

describe('Camera', () => {
  it('REQ-03 centers the world transform on the ship', () => {
    const camera = new Camera();
    const withCamera = vi.fn((_position, _zoom, draw: () => void) => draw());
    const drawing = { withCamera } as unknown as Drawing;
    camera.update({ x: 120, y: -40 }, { x: 0, y: 0 }, 1);

    camera.drawWorld(drawing, vi.fn());

    expect(withCamera).toHaveBeenCalledWith({ x: 120, y: -40 }, camera.zoom, expect.any(Function));
  });

  it('REQ-09 zooms farther out at higher ship speeds', () => {
    const slow = new Camera();
    const fast = new Camera();
    slow.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1);
    fast.update({ x: 0, y: 0 }, { x: 600, y: 0 }, 1);
    expect(fast.zoom).toBeLessThan(slow.zoom);
  });

  it('REQ-50 tunes the resting zoom from the default zoom-in level setting', () => {
    const close = new Camera();
    close.setBaseZoom(1.5);
    close.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1);
    const far = new Camera();
    far.setBaseZoom(0.6);
    far.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1);

    expect(close.zoom).toBeGreaterThan(far.zoom);

    const fast = new Camera();
    fast.setBaseZoom(1.5);
    fast.update({ x: 0, y: 0 }, { x: 600, y: 0 }, 1);
    expect(fast.zoom).toBeLessThan(close.zoom);
  });

  it('REQ-23 exposes the camera-visible world bounds for exploration', () => {
    const camera = new Camera();
    camera.update({ x: 100, y: 50 }, { x: 0, y: 0 }, 1);

    const bounds = camera.getVisibleWorldBounds({ width: 230, height: 115 });

    expect(bounds.left).toBeCloseTo(0);
    expect(bounds.top).toBeCloseTo(0);
    expect(bounds.right).toBeCloseTo(200);
    expect(bounds.bottom).toBeCloseTo(100);
  });

  it('REQ-25 exposes the zoomed visible radius for offscreen spawning', () => {
    const slow = new Camera();
    const fast = new Camera();
    slow.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1);
    fast.update({ x: 0, y: 0 }, { x: 600, y: 0 }, 1);

    expect(fast.getVisibleWorldRadius({ width: 1000, height: 600 }))
      .toBeGreaterThan(slow.getVisibleWorldRadius({ width: 1000, height: 600 }));
  });

  it('REQ-56 zooms farther out while any drone is hunting', () => {
    const calm = new Camera();
    const threatened = new Camera();
    calm.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, false);
    threatened.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, true);

    expect(threatened.zoom).toBeLessThan(calm.zoom);

    const fastCalm = new Camera();
    const fastThreatened = new Camera();
    fastCalm.update({ x: 0, y: 0 }, { x: 600, y: 0 }, 1, false);
    fastThreatened.update({ x: 0, y: 0 }, { x: 600, y: 0 }, 1, true);
    expect(fastThreatened.zoom).toBeLessThan(fastCalm.zoom);
  });

  it('REQ-56 eases back in when the drone threat clears', () => {
    const camera = new Camera();
    camera.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, true);
    const threatenedZoom = camera.zoom;

    camera.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, false);

    expect(camera.zoom).toBeGreaterThan(threatenedZoom);
  });

  it('REQ-60 zooms farther out while traversing empty space', () => {
    const calm = new Camera();
    const desolate = new Camera();
    calm.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, false, false);
    desolate.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, false, true);

    expect(desolate.zoom).toBeLessThan(calm.zoom);

    const fastCalm = new Camera();
    const fastDesolate = new Camera();
    fastCalm.update({ x: 0, y: 0 }, { x: 600, y: 0 }, 1, false, false);
    fastDesolate.update({ x: 0, y: 0 }, { x: 600, y: 0 }, 1, false, true);
    expect(fastDesolate.zoom).toBeLessThan(fastCalm.zoom);
  });

  it('REQ-60 keeps the mission 2 traversal pullback within a playable range', () => {
    const resting = new Camera();
    resting.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, false, true);

    const fast = new Camera();
    fast.update({ x: 0, y: 0 }, { x: 2000, y: 0 }, 1, false, true);

    expect(resting.zoom).toBeCloseTo(1);
    expect(fast.zoom).toBeCloseTo(0.35);
  });

  it('REQ-60 composes the desolation zoom with the hunting-drone pullback', () => {
    const camera = new Camera();
    camera.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, false, false);
    const base = camera.zoom;

    camera.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, true, false);
    const threatened = camera.zoom;

    camera.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, true, true);
    const both = camera.zoom;

    expect(threatened).toBeLessThan(base);
    expect(both).toBeLessThan(threatened);
  });

  it('REQ-03 shifts the ship opposite its travel direction so more space shows ahead', () => {
    const camera = new Camera();
    camera.setViewport({ width: 800, height: 600 });
    // Traveling upward: velocity points to negative y. The camera should lead the
    // ship upward, leaving the ship lower on screen so the player sees more above.
    for (let i = 0; i < 5; i++) camera.update({ x: 0, y: 0 }, { x: 0, y: -600 }, 1);

    expect(camera.worldPosition.y).toBeLessThan(camera.focusPosition.y);
    expect(camera.focusPosition.y - camera.worldPosition.y).toBeGreaterThan(0);
  });

  it('REQ-03 keeps the ship within the middle third of the screen at high speed', () => {
    const camera = new Camera();
    camera.setViewport({ width: 800, height: 600 });
    for (let i = 0; i < 5; i++) camera.update({ x: 0, y: 0 }, { x: 2000, y: 1500 }, 1);

    const offX = camera.worldPosition.x - camera.focusPosition.x;
    const offY = camera.worldPosition.y - camera.focusPosition.y;
    const screenOffX = Math.abs(offX * camera.zoom);
    const screenOffY = Math.abs(offY * camera.zoom);

    // Middle third => ship stays within +/- 1/6 of the viewport from center.
    expect(screenOffX).toBeLessThanOrEqual(800 / 6 + 0.001);
    expect(screenOffY).toBeLessThanOrEqual(600 / 6 + 0.001);
    expect(screenOffX).toBeGreaterThan(0);
    expect(screenOffY).toBeGreaterThan(0);
  });

  it('REQ-03 eases the look-ahead offset smoothly over frames', () => {
    const camera = new Camera();
    camera.setViewport({ width: 800, height: 600 });
    camera.update({ x: 0, y: 0 }, { x: 0, y: -600 }, 0.1);
    const earlyOffset = camera.worldPosition.y - camera.focusPosition.y;

    for (let i = 0; i < 30; i++) camera.update({ x: 0, y: 0 }, { x: 0, y: -600 }, 0.1);
    const settledOffset = camera.worldPosition.y - camera.focusPosition.y;

    expect(Math.abs(earlyOffset)).toBeGreaterThan(0);
    expect(Math.abs(earlyOffset)).toBeLessThan(Math.abs(settledOffset));
  });

  it('REQ-03 re-centers the ship when it comes to rest', () => {
    const camera = new Camera();
    camera.setViewport({ width: 800, height: 600 });
    for (let i = 0; i < 5; i++) camera.update({ x: 0, y: 0 }, { x: 0, y: -600 }, 1);
    expect(camera.worldPosition).not.toEqual(camera.focusPosition);

    for (let i = 0; i < 10; i++) camera.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1);

    expect(camera.worldPosition).toEqual(camera.focusPosition);
  });
});
