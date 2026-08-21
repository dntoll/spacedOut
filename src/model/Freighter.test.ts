import { describe, expect, it } from 'vitest';
import { Freighter } from './Freighter';
import { Star } from './Star';

describe('Freighter', () => {
  it('REQ-97 orbits the star inside the ice ring and can be reached', () => {
    const star = new Star();
    star.placeAt({ x: 0, y: 0 });
    const freighter = new Freighter();
    expect(freighter.isPlaced).toBe(false);
    freighter.placeAround(star, 0);
    expect(freighter.isPlaced).toBe(true);
    const start = { ...freighter.position };
    expect(Math.hypot(start.x, start.y)).toBeGreaterThan(star.radius * 4);

    freighter.update(1, star);
    expect(freighter.position).not.toEqual(start);

    expect(freighter.reachedBy(start, 18)).toBe(false);
    expect(freighter.reachedBy(freighter.position, 18)).toBe(true);
  });
});
