import { describe, expect, it, vi } from 'vitest';
import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';
import { NebulaCloud } from './NebulaCloud';
import { NebulaParticle } from './NebulaParticle';

const particleAt = (position: Vec2): NebulaParticle =>
  new NebulaParticle({ ...position }, { ...position }, 100, { r: 180, g: 90, b: 220 }, 0.5);

const stubDrawing = (): { drawing: Drawing; circles: ReturnType<typeof vi.fn> } => {
  const circles = vi.fn();
  return {
    drawing: { circle: circles } as unknown as Drawing,
    circles,
  };
};

describe('NebulaCloud', () => {
  it('REQ-67 sleeps settled particles while every cloud pusher is far away', () => {
    const particle = particleAt({ x: 0, y: 0 });
    const update = vi.spyOn(particle, 'update');
    const cloud = new NebulaCloud([particle]);

    cloud.update(0.016, [{ x: 5000, y: 5000 }]);

    expect(update).not.toHaveBeenCalled();
  });

  it('REQ-67 wakes an off-screen cloud when a ship, pirate, or drone enters it', () => {
    const particle = particleAt({ x: 0, y: 0 });
    const update = vi.spyOn(particle, 'update');
    const cloud = new NebulaCloud([particle]);

    cloud.update(0.016, [{ x: 60, y: 0 }]);

    expect(update).toHaveBeenCalledOnce();
    expect(particle.position.x).toBeLessThan(0);
  });

  it('REQ-67 submits only particles whose visible circles intersect the camera bounds', () => {
    const { drawing, circles } = stubDrawing();
    const cloud = new NebulaCloud([particleAt({ x: 0, y: 0 }), particleAt({ x: 2000, y: 0 })]);

    cloud.draw(drawing, { left: -400, top: -300, right: 400, bottom: 300 });

    expect(circles).toHaveBeenCalledOnce();
    expect(circles).toHaveBeenCalledWith({ x: 0, y: 0 }, 100, expect.any(Object));
  });

  it('REQ-67 skips all draw submissions when a cloud is outside the camera bounds', () => {
    const { drawing, circles } = stubDrawing();
    const cloud = new NebulaCloud([particleAt({ x: 5000, y: 5000 })]);

    cloud.draw(drawing, { left: -400, top: -300, right: 400, bottom: 300 });

    expect(circles).not.toHaveBeenCalled();
  });
});
