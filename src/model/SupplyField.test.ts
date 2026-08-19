import { describe, expect, it } from 'vitest';
import { AmmoContainer } from './AmmoContainer';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { CollectablePickup } from './CollectablePickup';
import { FuelContainer } from './FuelContainer';
import { HpContainer } from './HpContainer';
import { Ship } from './Ship';
import { SupplyField } from './SupplyField';
import type { SupplyContainer } from './SupplyContainer';

describe('SupplyField', () => {
  it('REQ-14 randomly spreads collectible supply containers', () => {
    const containers: SupplyContainer[] = [];
    new SupplyField({ x: 0, y: 0 }, undefined, 1234).forEachActive((container) => containers.push(container));

    expect(containers).toHaveLength(25);
    expect(containers.some((container) => container instanceof FuelContainer)).toBe(true);
    expect(containers.some((container) => container instanceof HpContainer)).toBe(true);
    expect(containers.some((container) => container instanceof AmmoContainer)).toBe(true);
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
    expect(positions(first)).toHaveLength(25);
    const distant: SupplyContainer[] = [];
    first.forEachActive((container) => distant.push(container));
    expect(distant.every((container) => Math.hypot(container.position.x, container.position.y) > 3500)).toBe(true);
  });

  it('REQ-14 collects containers when the ship reaches them', () => {
    const ship = new Ship();
    ship.consumeAmmo(40);
    ship.setControlTuning({ dampening: 1.5, thrustAccel: 170, maxSpeed: 100000 });
    ship.velocity = { x: 200, y: 0 };
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    ship.applyControls(1);
    const fuelBefore = ship.fuel;
    const ammoBefore = ship.ammo;
    const fuel = new FuelContainer({ ...ship.position }, 10);
    const ammo = new AmmoContainer({ ...ship.position }, 10);
    const field = new SupplyField(ship.position, [fuel, ammo]);

    field.update(0, ship, new AsteroidBelt(ship.position, []));

    expect(ship.fuel).toBeGreaterThan(fuelBefore);
    expect(ship.ammo).toBeGreaterThan(ammoBefore);
    const known: SupplyContainer[] = [];
    field.forEachKnown((container) => known.push(container));
    expect(known).not.toContain(fuel);
    expect(known).not.toContain(ammo);
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

  it('REQ-34 spreads repair containers that restore hull when collected', () => {
    const field = new SupplyField({ x: 0, y: 0 }, undefined, 4242);
    const spread: SupplyContainer[] = [];
    field.forEachActive((container) => spread.push(container));
    expect(spread.some((container) => container instanceof HpContainer)).toBe(true);

    const ship = new Ship();
    ship.takeDamage(40);
    expect(ship.hp).toBe(60);
    const hp = new HpContainer({ ...ship.position }, 30);
    const repairField = new SupplyField(ship.position, [hp]);

    repairField.update(0, ship, new AsteroidBelt(ship.position, []));

    expect(ship.hp).toBe(90);
    const known: SupplyContainer[] = [];
    repairField.forEachKnown((container) => known.push(container));
    expect(known).not.toContain(hp);
  });

  it('REQ-40 stably spreads ammo containers that replenish ammo when collected', () => {
    const field = new SupplyField({ x: 0, y: 0 }, undefined, 7777);
    const spread: SupplyContainer[] = [];
    field.forEachActive((container) => spread.push(container));
    expect(spread.some((container) => container instanceof AmmoContainer)).toBe(true);

    const ship = new Ship();
    ship.consumeAmmo(40);
    expect(ship.ammo).toBe(60);
    const ammo = new AmmoContainer({ ...ship.position }, 30);
    const ammoField = new SupplyField(ship.position, [ammo]);

    ammoField.update(0, ship, new AsteroidBelt(ship.position, []));

    expect(ship.ammo).toBe(90);
    const known: SupplyContainer[] = [];
    ammoField.forEachKnown((container) => known.push(container));
    expect(known).not.toContain(ammo);
  });

  it('REQ-40 collects ammo containers dropped from destroyed asteroids', () => {
    const ship = new Ship();
    ship.consumeAmmo(40);
    expect(ship.ammo).toBe(60);
    const field = new SupplyField(ship.position, []);
    const drop = new AmmoContainer({ ...ship.position }, 30);
    field.drop(drop);

    field.update(0, ship, new AsteroidBelt(ship.position, []));

    expect(ship.ammo).toBe(90);
    const active: SupplyContainer[] = [];
    field.forEachActive((container) => active.push(container));
    expect(active).not.toContain(drop);
  });

  it('REQ-47 attracts a nearby container toward the ship', () => {
    const ship = new Ship();
    ship.position = { x: 0, y: 0 };
    const container = new FuelContainer({ x: 60, y: 0 }, 10);
    const field = new SupplyField(ship.position, [container]);

    field.update(0, ship, new AsteroidBelt(ship.position, []));

    expect(container.velocity.x).toBeLessThan(0);
    expect(container.velocity.y).toBeCloseTo(0, 5);
  });

  it('REQ-47 leaves containers beyond three ship lengths stationary', () => {
    const ship = new Ship();
    ship.position = { x: 0, y: 0 };
    const container = new FuelContainer({ x: 200, y: 0 }, 10);
    const field = new SupplyField(ship.position, [container]);

    field.update(0, ship, new AsteroidBelt(ship.position, []));

    expect(container.velocity.x).toBe(0);
    expect(container.velocity.y).toBe(0);
  });

  it('REQ-47 pulls a nearby container in until it is collected', () => {
    const ship = new Ship();
    ship.position = { x: 0, y: 0 };
    const container = new FuelContainer({ x: 80, y: 0 }, 10);
    const field = new SupplyField(ship.position, [container]);
    const belt = new AsteroidBelt(ship.position, []);

    for (let step = 0; step < 30; step++) field.update(0.05, ship, belt);

    const active: SupplyContainer[] = [];
    field.forEachActive((current) => active.push(current));
    expect(active).not.toContain(container);
  });

  it('REQ-45 notifies observers when a region container is collected', () => {
    const ship = new Ship();
    const container = new FuelContainer({ ...ship.position }, 10);
    const field = new SupplyField(ship.position, [container]);
    const events: CollectablePickup[] = [];
    field.addCollectablePickupObserver({ onCollectablePickup(event) { events.push(event); } });

    field.update(0, ship, new AsteroidBelt(ship.position, []));

    expect(events).toHaveLength(1);
  });

  it('REQ-45 notifies observers when a dropped container is collected', () => {
    const ship = new Ship();
    const field = new SupplyField(ship.position, []);
    const drop = new FuelContainer({ ...ship.position }, 10);
    field.drop(drop);
    const events: CollectablePickup[] = [];
    field.addCollectablePickupObserver({ onCollectablePickup(event) { events.push(event); } });

    field.update(0, ship, new AsteroidBelt(ship.position, []));

    expect(events).toHaveLength(1);
  });

  it('REQ-51 favors the lowest ship meter when spawning reached-region containers', () => {
    const ship = new Ship();
    ship.setControlTuning({ dampening: 1.5, thrustAccel: 170, maxSpeed: 100000 });
    ship.aimAt({ x: 1e9, y: 0 });
    ship.startThrust();
    for (let i = 0; i < 400 && ship.fuel > 0; i++) ship.applyControls(0.1);
    expect(ship.fuel).toBe(0);
    ship.position = { x: 50000, y: 0 };

    const field = new SupplyField({ x: 0, y: 0 }, undefined, 1234);
    field.update(0, ship, new AsteroidBelt(ship.position, []), 1500, 1500);

    const containers: SupplyContainer[] = [];
    field.forEachActive((container) => containers.push(container));

    expect(containers).toHaveLength(25);
    expect(containers.every((container) => container instanceof FuelContainer)).toBe(true);
  });

  it('REQ-51 favors the next meter when the lowest is already visible on screen', () => {
    const ship = new Ship();
    ship.setControlTuning({ dampening: 1.5, thrustAccel: 170, maxSpeed: 100000 });
    ship.aimAt({ x: 1e9, y: 0 });
    ship.startThrust();
    for (let i = 0; i < 400 && ship.fuel > 0; i++) ship.applyControls(0.1);
    expect(ship.fuel).toBe(0);
    ship.position = { x: 50000, y: 0 };

    const field = new SupplyField({ x: 0, y: 0 }, undefined, 1234);
    const visibleFuel = new FuelContainer({ x: 50000 + 100, y: 0 }, 10);
    field.drop(visibleFuel);
    field.update(0, ship, new AsteroidBelt(ship.position, []), 1500, 1500);

    const containers: SupplyContainer[] = [];
    field.forEachActive((container) => containers.push(container));
    const spawned = containers.filter((container) => container !== visibleFuel);

    expect(spawned).toHaveLength(25);
    expect(spawned.every((container) => container instanceof HpContainer || container instanceof AmmoContainer)).toBe(true);
    expect(spawned.some((container) => container instanceof FuelContainer)).toBe(false);
  });
});
