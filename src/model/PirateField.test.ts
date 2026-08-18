import { describe, expect, it } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { Collision } from './Collision';
import { Damage } from './Damage';
import { Drone } from './Drone';
import { DroneField } from './DroneField';
import { MassiveAsteroid } from './MassiveAsteroid';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import { Pirate } from './Pirate';
import { PirateDestroyed } from './PirateDestroyed';
import { PirateField } from './PirateField';
import { Ship } from './Ship';
import { length, sub } from '../math';

const VERTICES = [1, 1, 1, 1];
const emptyBelt = () => new AsteroidBelt({ x: 0, y: 0 }, []);
const emptyMassive = () => new MassiveAsteroidField({ x: 0, y: 0 }, 18, []);

describe('PirateField', () => {
  it('REQ-63 spawns dormant pirate ships beyond the visible boundary and their detection ring', () => {
    const ship = new Ship();
    const field = new PirateField();
    const detection = field.detectionRange(ship);

    field.update(0, ship, emptyBelt(), emptyMassive(), 1500, true);

    expect(field.count).toBeGreaterThan(0);
    field.forEachPirate((pirate) => {
      expect(pirate.awake).toBe(false);
      expect(length(sub(pirate.position, ship.position))).toBeGreaterThan(detection);
    });
  });

  it('REQ-63 uses a larger detection distance than mining drones', () => {
    const ship = new Ship();
    const pirates = new PirateField();
    const drones = new DroneField();

    expect(pirates.detectionRange(ship)).toBeGreaterThan(drones.detachRange(ship));
  });

  it('REQ-63 awakens and hunts the ship when it comes within detection range', () => {
    const ship = new Ship();
    const pirate = new Pirate({ x: 1000, y: 0 }, VERTICES, 3);
    pirate.angle = Math.PI;
    const field = new PirateField([pirate]);

    field.update(0.02, ship, emptyBelt(), emptyMassive(), 1500, false);
    expect(pirate.awake).toBe(true);

    const beforeX = pirate.position.x;
    field.update(0.5, ship, emptyBelt(), emptyMassive(), 1500, false);
    expect(pirate.position.x).toBeLessThan(beforeX);
  });

  it('REQ-63 pirate ships fire lasers that damage the ship', () => {
    const ship = new Ship();
    const pirate = new Pirate({ x: 1100, y: 0 }, VERTICES, 3);
    pirate.angle = Math.PI;
    const field = new PirateField([pirate]);
    const damages: Damage[] = [];
    field.addDamageObserver({ onDamage: (damage) => damages.push(damage) });
    const hpBefore = ship.hp;

    for (let step = 0; step < 80; step++) field.update(0.05, ship, emptyBelt(), emptyMassive(), 1500, false);

    expect(damages.length).toBeGreaterThan(0);
    expect(ship.hp).toBeLessThan(hpBefore);
  });

  it('REQ-63 does not damage the ship by ramming', () => {
    const ship = new Ship();
    const pirate = new Pirate({ x: ship.radius + 42 - 1, y: 0 }, VERTICES, 3);
    const field = new PirateField([pirate]);
    const damages: Damage[] = [];
    field.addDamageObserver({ onDamage: (damage) => damages.push(damage) });
    const hpBefore = ship.hp;

    field.update(0.01, ship, emptyBelt(), emptyMassive(), 1500, false);

    expect(damages).toHaveLength(0);
    expect(ship.hp).toBe(hpBefore);
  });

  it('REQ-63 takes three laser hits to destroy a pirate ship', () => {
    const pirate = new Pirate({ x: 0, y: 0 }, VERTICES, 3);
    const field = new PirateField([pirate]);
    const events: PirateDestroyed[] = [];
    field.addPirateDestroyedObserver({ onPirateDestroyed: (event) => events.push(event) });
    const position = { ...pirate.position };

    field.applyLaserHit(pirate, position);
    expect(field.has(pirate)).toBe(true);
    field.applyLaserHit(pirate, position);
    expect(field.has(pirate)).toBe(true);
    field.applyLaserHit(pirate, position);

    expect(field.has(pirate)).toBe(false);
    expect(events).toHaveLength(1);
  });

  it('REQ-63 recycles a hunting pirate that the ship outruns beyond the give-up distance', () => {
    const ship = new Ship();
    const pirate = new Pirate({ x: 3500, y: 0 }, VERTICES, 3);
    pirate.awaken();
    const field = new PirateField([pirate]);

    field.update(0, ship, emptyBelt(), emptyMassive(), 1500, false);

    expect(field.has(pirate)).toBe(false);
  });

  it('REQ-63 pirate lasers destroy regular asteroids they hit', () => {
    const ship = new Ship();
    const pirate = new Pirate({ x: 600, y: 0 }, VERTICES, 3);
    pirate.angle = Math.PI;
    pirate.awaken();
    const field = new PirateField([pirate]);
    const asteroid = new Asteroid(1, { x: 300, y: 0 }, { x: 0, y: 0 }, 50, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);

    for (let step = 0; step < 60; step++) field.update(0.05, ship, belt, emptyMassive(), 1500, false);

    expect(belt.has(asteroid)).toBe(false);
  });

  it('REQ-63 spawns pirates in grouped squads around shared centers', () => {
    const ship = new Ship();
    const field = new PirateField();

    field.update(0, ship, emptyBelt(), emptyMassive(), 1500, true);

    const pirates: Pirate[] = [];
    field.forEachPirate((p) => pirates.push(p));
    expect(pirates.length).toBeGreaterThanOrEqual(2);
    let closePair = false;
    for (let i = 0; i < pirates.length && !closePair; i++) {
      for (let j = i + 1; j < pirates.length; j++) {
        if (length(sub(pirates[i].position, pirates[j].position)) < 800) closePair = true;
      }
    }
    expect(closePair).toBe(true);
  });

  it('REQ-63 peripheral squads stay dormant as the ship passes along the route', () => {
    const ship = new Ship();
    const field = new PirateField();

    field.update(0, ship, emptyBelt(), emptyMassive(), 1500, true, { x: 1, y: 0 });
    const peripheral: Pirate[] = [];
    field.forEachPirate((p) => { if (p.peripheral) peripheral.push(p); });
    expect(peripheral.length).toBeGreaterThan(0);

    ship.position = { x: 3000, y: 0 };
    field.update(0.1, ship, emptyBelt(), emptyMassive(), 1500, false, { x: 1, y: 0 });

    let stillDormant = 0;
    field.forEachPirate((p) => { if (p.peripheral && !p.awake) stillDormant++; });
    expect(stillDormant).toBeGreaterThan(0);
  });

  it('REQ-12 pirates bounce off regular asteroids and emit a collision', () => {
    const ship = new Ship();
    const pirate = new Pirate({ x: 60, y: 0 }, VERTICES, 3);
    pirate.velocity = { x: -40, y: 0 };
    const asteroid = new Asteroid(1, { x: 0, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const field = new PirateField([pirate]);
    const collisions: Collision[] = [];
    field.addCollisionObserver({ onCollision: (c) => collisions.push(c) });

    field.update(0, ship, belt, emptyMassive(), 1500, false);

    expect(collisions.length).toBeGreaterThan(0);
    expect(pirate.velocity.x).toBeGreaterThan(-40);
  });

  it('REQ-12 pirates crash-destroy on high-speed impact with a regular asteroid', () => {
    const ship = new Ship();
    const pirate = new Pirate({ x: 60, y: 0 }, VERTICES, 1);
    pirate.velocity = { x: -1000, y: 0 };
    const asteroid = new Asteroid(1, { x: 0, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const field = new PirateField([pirate]);
    const events: PirateDestroyed[] = [];
    field.addPirateDestroyedObserver({ onPirateDestroyed: (e) => events.push(e) });

    field.update(0, ship, belt, emptyMassive(), 1500, false);

    expect(field.has(pirate)).toBe(false);
    expect(events).toHaveLength(1);
  });

  it('REQ-63 pirate lasers hit and destroy other pirates (friendly fire) but not the owner', () => {
    const ship = new Ship();
    ship.position = { x: -1000, y: 0 };
    const shooter = new Pirate({ x: 0, y: 0 }, VERTICES, 3);
    shooter.angle = Math.PI;
    shooter.awaken();
    const victim = new Pirate({ x: -100, y: 0 }, VERTICES, 1);
    victim.angle = Math.PI;
    victim.awaken();
    const field = new PirateField([shooter, victim]);
    const events: PirateDestroyed[] = [];
    field.addPirateDestroyedObserver({ onPirateDestroyed: (e) => events.push(e) });

    for (let step = 0; step < 80; step++) field.update(0.05, ship, emptyBelt(), emptyMassive(), 1500, false);

    expect(field.has(victim)).toBe(false);
    expect(field.has(shooter)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it('REQ-12 repulses pirates from drones and other pirates so they do not overlap', () => {
    const pirateA = new Pirate({ x: 0, y: 0 }, VERTICES, 3);
    const pirateB = new Pirate({ x: 50, y: 0 }, VERTICES, 3);
    const drone = new Drone(null, 0, [1, 1, 1], 2);
    drone.position = { x: 25, y: 0 };
    const field = new PirateField([pirateA, pirateB]);

    const before = length(sub(pirateA.position, pirateB.position));
    field.applySeparation([drone], 0.016);
    const after = length(sub(pirateA.position, pirateB.position));

    expect(after).toBeGreaterThan(before);
  });

  it('REQ-63 pirates turn at a limited rate and do not snap to face the ship', () => {
    const ship = new Ship();
    const pirate = new Pirate({ x: 1000, y: 0 }, VERTICES, 3);
    pirate.angle = 0;
    pirate.awaken();
    const field = new PirateField([pirate]);
    const angleBefore = pirate.angle;

    field.update(0.05, ship, emptyBelt(), emptyMassive(), 1500, false);

    const angleChange = Math.abs(pirate.angle - angleBefore);
    expect(angleChange).toBeLessThan(Math.PI);
    expect(angleChange).toBeGreaterThan(0);
  });

  it('REQ-63 pirates make looping passes rather than monotonically closing', () => {
    const ship = new Ship();
    const pirate = new Pirate({ x: 1000, y: 0 }, VERTICES, 3);
    pirate.angle = Math.PI;
    pirate.awaken();
    const field = new PirateField([pirate]);

    const distances: number[] = [];
    for (let step = 0; step < 200; step++) {
      field.update(0.05, ship, emptyBelt(), emptyMassive(), 1500, false);
      distances.push(length(sub(pirate.position, ship.position)));
    }

    const minDist = Math.min(...distances);
    const maxDist = Math.max(...distances);
    expect(maxDist - minDist).toBeGreaterThan(200);
  });

  it('REQ-63 pirates do not fire when the ship is behind their nose', () => {
    const ship = new Ship();
    const pirate = new Pirate({ x: 0, y: 0 }, VERTICES, 3);
    pirate.angle = 0;
    pirate.awaken();
    const field = new PirateField([pirate]);
    ship.position = { x: -200, y: 0 };

    for (let step = 0; step < 40; step++) field.update(0.05, ship, emptyBelt(), emptyMassive(), 1500, false);

    let laserCount = 0;
    field.forEachLaser(() => laserCount++);
    expect(laserCount).toBe(0);
  });
});
