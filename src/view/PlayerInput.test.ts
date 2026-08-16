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
    } as unknown as Drawing;
    const input = new PlayerInput(drawing, vi.fn());

    down?.({ x: 100, y: 100, pointerId: 1, pointerType: 'mouse' });
    expect(input.isThrusting).toBe(true);
    up?.({ x: 100, y: 100, pointerId: 1, pointerType: 'mouse' });
    expect(input.isThrusting).toBe(false);
    down?.({ x: 200, y: 200, pointerId: 42, pointerType: 'touch' });
    expect(input.isThrusting).toBe(true);
  });
});
