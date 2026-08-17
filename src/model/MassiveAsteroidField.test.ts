import { describe, expect, it } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { Collision } from './Collision';
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
    new MassiveAsteroidField(ship.position, ship.radius, undefined, 123).forEachActive((asteroid) => massive.push(asteroid));

    expect(massive).toHaveLength(9);
    for (const asteroid of massive) {
      expect(asteroid.radius).toBeGreaterThanOrEqual(ship.radius * 30);
      expect(asteroid.radius).toBeLessThanOrEqual(ship.radius * 100);
      expect(asteroid.mass).toBe(Number.POSITIVE_INFINITY);
      expect(asteroid.vertices.some((variation) => variation < 0.55)).toBe(true);
      expect(asteroid.cavities.length).toBeGreaterThanOrEqual(9);
      const craterFractions = asteroid.cavities.map((cavity) => cavity.radius / asteroid.radius);
      expect(craterFractions.some((size) => size < 0.05)).toBe(true);
      expect(craterFractions.some((size) => size >= 0.08 && size <= 0.12)).toBe(true);
      expect(craterFractions.some((size) => size >= 0.14)).toBe(true);
      expect(craterFractions.filter((size) => size < 0.09).length)
        .toBeGreaterThan(craterFractions.filter((size) => size >= 0.14).length);
      const polygon = asteroid.vertices.map((variation, index) => {
        const angle = index / asteroid.vertices.length * Math.PI * 2;
        return {
          x: Math.cos(angle) * asteroid.radius * variation,
          y: Math.sin(angle) * asteroid.radius * variation,
        };
      });
      for (const cavity of asteroid.cavities) {
        let nearestEdge = Number.POSITIVE_INFINITY;
        for (let index = 0; index < polygon.length; index++) {
          const start = polygon[index];
          const end = polygon[(index + 1) % polygon.length];
          const edge = { x: end.x - start.x, y: end.y - start.y };
          const edgeLengthSquared = edge.x * edge.x + edge.y * edge.y;
          const amount = Math.max(0, Math.min(1,
            ((cavity.position.x - start.x) * edge.x + (cavity.position.y - start.y) * edge.y)
              / edgeLengthSquared,
          ));
          nearestEdge = Math.min(nearestEdge, Math.hypot(
            cavity.position.x - (start.x + edge.x * amount),
            cavity.position.y - (start.y + edge.y * amount),
          ));
        }
        expect(nearestEdge).toBeGreaterThan(cavity.radius);
      }
      expect(asteroid.cavities.some((cavity) => Math.hypot(cavity.position.x, cavity.position.y) > asteroid.radius * 0.3))
        .toBe(true);
    }
  });

  it('REQ-24 stably spreads massive asteroids through distant world regions', () => {
    const ship = new Ship();
    const field = new MassiveAsteroidField(ship.position, ship.radius, undefined, 456);
    const positions = (active: boolean) => {
      const values: string[] = [];
      const visit = (asteroid: MassiveAsteroid) => values.push(
        `${asteroid.position.x.toFixed(3)},${asteroid.position.y.toFixed(3)}`,
      );
      if (active) field.forEachActive(visit);
      else field.forEachKnown(visit);
      return values.sort();
    };
    const origin = positions(true);

    field.prepareAround({ x: 18000, y: 0 }, 1500);
    const distant = positions(true);
    const knownAfterTravel = positions(false);
    field.prepareAround(ship.position, 1500);

    expect(distant.every((position) => Number(position.split(',')[0]) > 10000)).toBe(true);
    expect(knownAfterTravel.length).toBeGreaterThan(origin.length);
    expect(positions(true)).toEqual(origin);
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

  it('REQ-45 emits an AsteroidCollision when a regular asteroid hits a massive one', () => {
    const massive = new MassiveAsteroid(1, { x: 0, y: 0 }, 100, 0, [1, 1, 1, 1, 1, 1], [], 0.5);
    const field = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [massive]);
    const asteroid = new Asteroid(2, { x: 95, y: 0 }, { x: -25, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const supplies = new SupplyField({ x: 0, y: 0 }, []);
    const events: Collision[] = [];
    field.addAsteroidCollisionObserver({ onAsteroidCollision: (collision) => events.push(collision) });

    field.resolveBodyCollisions(belt, supplies);

    expect(events.length).toBeGreaterThan(0);
  });

  it('REQ-45 does not emit an AsteroidCollision when a supply container hits a massive asteroid', () => {
    const massive = new MassiveAsteroid(1, { x: 0, y: 0 }, 100, 0, [1, 1, 1, 1, 1, 1], [], 0.5);
    const field = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [massive]);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, []);
    const container = new FuelContainer({ x: 80, y: 0 });
    container.velocity = { x: -20, y: 0 };
    const supplies = new SupplyField({ x: 0, y: 0 }, [container]);
    const events: Collision[] = [];
    field.addAsteroidCollisionObserver({ onAsteroidCollision: (collision) => events.push(collision) });

    field.resolveBodyCollisions(belt, supplies);

    expect(events).toHaveLength(0);
  });
});
