import { describe, expect, it } from 'vitest';
import { IceRing, ICE_RING_INNER_RADIUS, ICE_RING_OUTER_RADIUS } from './IceRing';
import { Star } from './Star';

describe('IceRing', () => {
  it('REQ-95 orbits colliding ice blocks well outside the star', () => {
    const star = new Star();
    star.placeAt({ x: 100, y: 200 }, 900);
    const ring = new IceRing();
    ring.placeAround(star);

    expect(ring.isPlaced).toBe(true);
    expect(ring.count).toBeGreaterThan(20);
    expect(ICE_RING_INNER_RADIUS).toBeGreaterThan(star.radius * 4);

    ring.forEach((block) => {
      expect(block.orbitalRadius).toBeGreaterThanOrEqual(ICE_RING_INNER_RADIUS);
      expect(block.orbitalRadius).toBeLessThanOrEqual(ICE_RING_OUTER_RADIUS);
      const dx = block.position.x - star.position.x;
      const dy = block.position.y - star.position.y;
      expect(Math.hypot(dx, dy)).toBeCloseTo(block.orbitalRadius, 5);
    });

    const first = { x: 0, y: 0 };
    ring.forEach((block) => {
      if (block.id === 0) { first.x = block.position.x; first.y = block.position.y; }
    });
    ring.update(0.5, star);
    let moved = false;
    ring.forEach((block) => {
      if (block.id === 0) moved = block.position.x !== first.x || block.position.y !== first.y;
    });
    expect(moved).toBe(true);
  });
});
