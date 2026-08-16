import { describe, expect, it } from 'vitest';
import { Asteroid } from './Asteroid';
import { Ship } from './Ship';

describe('physics entities', () => {
  it('REQ-02 integrates spaceship and asteroid motion', () => {
    const ship = new Ship();
    const asteroid = new Asteroid(1, { x: 10, y: 20 }, { x: -3, y: 4 }, 25, 0, 0.5, [1, 1, 1], 0.5);
    ship.velocity = { x: 8, y: -2 };

    ship.integrate(0.5);
    asteroid.integrate(0.5);

    expect(ship.position).toEqual({ x: 4, y: -1 });
    expect(asteroid.position).toEqual({ x: 8.5, y: 22 });
    expect(asteroid.angle).toBeCloseTo(0.25);
  });
});
