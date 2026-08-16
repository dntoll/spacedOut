import { describe, expect, it } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { FuelContainer } from './FuelContainer';
import { MassiveAsteroid } from './MassiveAsteroid';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import { Ship } from './Ship';
import { ShipCollisionSystem } from './ShipCollisionSystem';
import { SupplyField } from './SupplyField';

describe('MassiveAsteroidField', () => {
  it('REQ-20 creates immovable asteroids 30–100 ship radii across with concavities and cavities', () => {
    const ship = new Ship();
    const massive: MassiveAsteroid[] = [];
    new MassiveAsteroidField(ship.position, ship.radius).forEach((asteroid) => massive.push(asteroid));

    expect(massive).toHaveLength(4);
    for (const asteroid of massive) {
      expect(asteroid.radius).toBeGreaterThanOrEqual(ship.radius * 30);
      expect(asteroid.radius).toBeLessThanOrEqual(ship.radius * 100);
      expect(asteroid.mass).toBe(Number.POSITIVE_INFINITY);
      expect(asteroid.vertices.some((variation) => variation < 0.55)).toBe(true);
      expect(asteroid.cavities.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('REQ-20 remains fixed while ship, asteroid, and container bounce from it', () => {
    const massive = new MassiveAsteroid(
      1, { x: 0, y: 0 }, 100, 0,
      [1, 0.4, 1, 0.5, 1, 1],
      [{ position: { x: 20, y: 10 }, radius: 12 }],
      0.5,
    );
    const field = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [massive]);
    const ship = new Ship();
    ship.position = { x: 110, y: 0 };
    ship.previousPosition = { x: 130, y: 0 };
    ship.velocity = { x: -30, y: 4 };
    const asteroid = new Asteroid(2, { x: -65, y: 0 }, { x: 25, y: 5 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt(ship.position, [asteroid]);
    const container = new FuelContainer({ x: 0, y: 80 });
    container.velocity = { x: 3, y: -15 };
    const supplies = new SupplyField(ship.position, [container]);
    const originalPosition = { ...massive.position };

    new ShipCollisionSystem().resolve(ship, [massive], 1);
    field.resolveBodyCollisions(belt, supplies);

    expect(massive.position).toEqual(originalPosition);
    expect(massive.velocity).toEqual({ x: 0, y: 0 });
    expect(massive.angularVelocity).toBe(0);
    expect(ship.velocity.x).toBeGreaterThan(-30);
    expect(asteroid.velocity.x).toBeLessThan(25);
    expect(container.velocity.y).toBeGreaterThan(-15);
  });

  it('REQ-21 does not collide outside a concave section of the visible outline', () => {
    const massive = new MassiveAsteroid(
      1, { x: 0, y: 0 }, 100, 0,
      [1, 0.4, 1, 1, 1, 1], [], 0.5,
    );
    const field = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [massive]);
    const ship = new Ship();
    const concaveAngle = Math.PI / 3;
    ship.position = { x: Math.cos(concaveAngle) * 70, y: Math.sin(concaveAngle) * 70 };
    ship.previousPosition = { ...ship.position };
    ship.velocity = { x: -Math.cos(concaveAngle) * 10, y: -Math.sin(concaveAngle) * 10 };
    const belt = new AsteroidBelt(ship.position, []);
    const supplies = new SupplyField(ship.position, []);
    const velocityOutsideRock = { ...ship.velocity };

    new ShipCollisionSystem().resolve(ship, [massive], 1);
    expect(ship.velocity.x).toBeCloseTo(velocityOutsideRock.x);
    expect(ship.velocity.y).toBeCloseTo(velocityOutsideRock.y);

    ship.position = { x: Math.cos(concaveAngle) * 50, y: Math.sin(concaveAngle) * 50 };
    ship.previousPosition = { x: Math.cos(concaveAngle) * 70, y: Math.sin(concaveAngle) * 70 };
    new ShipCollisionSystem().resolve(ship, [massive], 1);
    expect(ship.velocity.x).not.toBeCloseTo(velocityOutsideRock.x);
  });
});
