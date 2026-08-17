import { describe, expect, it, vi } from 'vitest';
import type { Drawing, PointerPosition } from './Drawing';
import { PlayerInput } from './PlayerInput';

describe('PlayerInput', () => {
  it('REQ-05 handles both mouse and touch pointer controls', () => {
    let down: ((pointer: PointerPosition) => void) | undefined;
    let up: ((pointer: PointerPosition) => void) | undefined;
    const drawing = {
      size: { width: 800, height: 600 },
      onPointerMove: vi.fn(),
      onPointerDown: (listener: typeof down) => { down = listener; },
      onPointerUp: (listener: typeof up) => { up = listener; },
      onPointerCancel: vi.fn(),
      onBlur: vi.fn(),
      capturePointer: vi.fn(),
      releasePointer: vi.fn(),
      onKeyDown: vi.fn(),
      onKeyUp: vi.fn(),
    } as unknown as Drawing;
    const input = new PlayerInput(drawing, vi.fn());

    down?.({ x: 100, y: 100, pointerId: 1, pointerType: 'mouse' });
    expect(input.isThrusting).toBe(false);
    down?.({ x: 200, y: 200, pointerId: 42, pointerType: 'touch' });
    expect(input.isThrusting).toBe(true);
    up?.({ x: 200, y: 200, pointerId: 42, pointerType: 'touch' });
    expect(input.isThrusting).toBe(false);
  });

  it('REQ-37 reads WASD into a ship-axis directional thrust vector', () => {
    let keyDown: ((key: string) => void) | undefined;
    let keyUp: ((key: string) => void) | undefined;
    const drawing = {
      size: { width: 800, height: 600 },
      onPointerMove: vi.fn(),
      onPointerDown: vi.fn(),
      onPointerUp: vi.fn(),
      onPointerCancel: vi.fn(),
      onBlur: vi.fn(),
      capturePointer: vi.fn(),
      releasePointer: vi.fn(),
      onKeyDown: (listener: typeof keyDown) => { keyDown = listener; },
      onKeyUp: (listener: typeof keyUp) => { keyUp = listener; },
    } as unknown as Drawing;
    const input = new PlayerInput(drawing, vi.fn());

    expect(input.getDirectionalThrust()).toBeNull();

    keyDown?.('w');
    expect(input.getDirectionalThrust()).toEqual({ x: 1, y: 0 });

    keyDown?.('d');
    const diag = input.getDirectionalThrust()!;
    expect(diag.x).toBeCloseTo(Math.SQRT1_2, 5);
    expect(diag.y).toBeCloseTo(Math.SQRT1_2, 5);

    keyUp?.('w');
    keyUp?.('d');
    expect(input.getDirectionalThrust()).toBeNull();
  });

  it('REQ-37 mouse pointers do not trigger thrust, only touch does', () => {
    let down: ((pointer: PointerPosition) => void) | undefined;
    const drawing = {
      size: { width: 800, height: 600 },
      onPointerMove: vi.fn(),
      onPointerDown: (listener: typeof down) => { down = listener; },
      onPointerUp: vi.fn(),
      onPointerCancel: vi.fn(),
      onBlur: vi.fn(),
      capturePointer: vi.fn(),
      releasePointer: vi.fn(),
      onKeyDown: vi.fn(),
      onKeyUp: vi.fn(),
    } as unknown as Drawing;
    const input = new PlayerInput(drawing, vi.fn());

    down?.({ x: 100, y: 100, pointerId: 1, pointerType: 'mouse' });
    expect(input.isThrusting).toBe(false);
  });
});
