import { describe, expect, it } from 'vitest';
import { AirContainer } from './AirContainer';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { FuelContainer } from './FuelContainer';
import { Ship } from './Ship';
import { SupplyField } from './SupplyField';
import type { SupplyContainer } from './SupplyContainer';

describe('SupplyField', () => {
  it('REQ-14 randomly spreads collectible air and fuel containers', () => {
    const containers: SupplyContainer[] = [];
    new SupplyField({ x: 0, y: 0 }, undefined, 1234).forEachActive((container) => containers.push(container));

    expect(containers).toHaveLength(98);
    expect(containers.some((container) => container instanceof AirContainer)).toBe(true);
    expect(containers.some((container) => container instanceof FuelContainer)).toBe(true);
    expect(new Set(containers.map((container) => `${container.position.x},${container.position.y}`)).size).toBeGreaterThan(1);
  });

  it('REQ-14 generates stable supplies in distant reached regions', () => {
    const ship = new Ship();
    ship.position = { x: 7200, y: -4800 };
    const first = new SupplyField({ x: 0, y: 0 }, undefined, 9876);
    const second = new SupplyField({ x: 0, y: 0 }, undefined, 9876);
    const emptyBelt = new AsteroidBelt(ship.position, []);

    first.update(0, ship, emptyBelt);
    second.update(0, ship, emptyBelt);
    const positions = (field: SupplyField) => {
      const values: string[] = [];
      field.forEachActive((container) => values.push(
        `${container.constructor.name}:${container.position.x.toFixed(4)},${container.position.y.toFixed(4)}`,
      ));
      return values.sort();
    };

    expect(positions(first)).toEqual(positions(second));
    expect(positions(first)).toHaveLength(98);
    const distant: SupplyContainer[] = [];
    first.forEachActive((container) => distant.push(container));
    expect(distant.every((container) => Math.hypot(container.position.x, container.position.y) > 3500)).toBe(true);
  });

  it('REQ-14 collects containers when the ship reaches them', () => {
    const ship = new Ship();
    ship.updateLifeSupport(20);
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    ship.applyControls(1);
    const airBefore = ship.air;
    const fuelBefore = ship.fuel;
    const air = new AirContainer({ ...ship.position }, 10);
    const fuel = new FuelContainer({ ...ship.position }, 10);
    const field = new SupplyField(ship.position, [air, fuel]);

    field.update(0, ship, new AsteroidBelt(ship.position, []));

    expect(ship.air).toBeGreaterThan(airBefore);
    expect(ship.fuel).toBeGreaterThan(fuelBefore);
    const known: SupplyContainer[] = [];
    field.forEachKnown((container) => known.push(container));
    expect(known).not.toContain(air);
    expect(known).not.toContain(fuel);
  });

  it('REQ-18 physically collides containers with asteroids', () => {
    const ship = new Ship();
    ship.position = { x: 1000, y: 1000 };
    const container = new FuelContainer({ x: 0, y: 0 });
    const asteroid = new Asteroid(1, { x: 20, y: 0 }, { x: -30, y: 8 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt(ship.position, [asteroid]);
    const field = new SupplyField(ship.position, [container]);

    field.update(0, ship, belt);

    expect(container.velocity.x).toBeLessThan(0);
    expect(asteroid.velocity.x).toBeGreaterThan(-30);
    expect(asteroid.angularVelocity).not.toBe(0);
  });
});
