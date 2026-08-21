import { describe, expect, it } from 'vitest';
import { Ship } from './Ship';
import { STAR_RADIUS, Star } from './Star';

describe('Star', () => {
  it('REQ-94 places Omega III at a screen-scale radius', () => {
    const star = new Star();
    expect(star.isPlaced).toBe(false);
    star.placeAt({ x: 4000, y: -2000 });
    expect(star.isPlaced).toBe(true);
    expect(star.position).toEqual({ x: 4000, y: -2000 });
    expect(star.radius).toBe(STAR_RADIUS);
    expect(star.radius).toBeGreaterThan(800);
  });

  it('REQ-94 damages a ship that approaches and is lethal at the surface', () => {
    const star = new Star();
    star.placeAt({ x: 0, y: 0 }, 100);
    const far = new Ship();
    far.position = { x: 1000, y: 0 };
    expect(star.heatFor(far)).toBe(0);

    const near = new Ship();
    near.position = { x: 180, y: 0 };
    const edge = star.heatFor(near);
    expect(edge).toBeGreaterThan(0);

    const closer = new Ship();
    closer.position = { x: 110, y: 0 };
    expect(star.heatFor(closer)).toBeGreaterThan(edge);

    const inside = new Ship();
    inside.position = { x: 10, y: 0 };
    star.applyHeat(inside);
    expect(inside.hp).toBeLessThan(100);
  });

  it('REQ-94 lets the shield absorb stellar heat before the hull', () => {
    const star = new Star();
    star.placeAt({ x: 0, y: 0 }, 100);
    const ship = new Ship();
    ship.installShield();
    ship.updateShieldCharge(4);
    ship.position = { x: 10, y: 0 };
    const heat = star.heatFor(ship);
    expect(heat).toBeGreaterThan(0);
    star.applyHeat(ship);
    expect(ship.shield).toBeLessThan(100);
    expect(ship.hp).toBe(100);
  });
});
