import { describe, expect, it, vi } from 'vitest';
import { Collision } from '../model/Collision';
import type { Drawing } from './Drawing';
import { CollisionEffects } from './CollisionEffects';

describe('CollisionEffects', () => {
  it('REQ-13 creates visible particles from collision observations', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const circle = vi.fn();
    const drawing = {
      withAdditiveBlend: (draw: () => void) => draw(),
      circle,
    } as unknown as Drawing;
    const effects = new CollisionEffects();

    effects.emit(new Collision({ x: 10, y: 20 }, { x: 1, y: 0 }, 100));
    effects.draw(drawing);

    expect(circle).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
