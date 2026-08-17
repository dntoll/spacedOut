import { describe, expect, it, vi } from 'vitest';
import { Collision } from '../model/Collision';
import type { Drawing } from './Drawing';
import { CollisionEffects } from './CollisionEffects';

const stubDrawing = () => {
  const circle = vi.fn();
  return { drawing: { withAdditiveBlend: (draw: () => void) => draw(), circle } as unknown as Drawing, circle };
};

describe('CollisionEffects', () => {
  it('REQ-13 creates visible particles from collision observations', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { drawing, circle } = stubDrawing();
    const effects = new CollisionEffects();

    effects.emit(new Collision({ x: 10, y: 20 }, { x: 1, y: 0 }, 100));
    effects.draw(drawing);

    expect(circle).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('REQ-35 emits a large particle burst on damage', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { drawing, circle } = stubDrawing();
    const effects = new CollisionEffects();

    effects.emitDamageBurst({ x: 0, y: 0 });
    effects.draw(drawing);

    expect(circle.mock.calls.length).toBeGreaterThanOrEqual(40);
    vi.restoreAllMocks();
  });

  it('REQ-36 emits an explosion burst when the ship is destroyed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { drawing, circle } = stubDrawing();
    const effects = new CollisionEffects();

    effects.emitExplosion({ x: 0, y: 0 });
    effects.draw(drawing);

    expect(circle.mock.calls.length).toBeGreaterThanOrEqual(150);
    vi.restoreAllMocks();
  });
});
