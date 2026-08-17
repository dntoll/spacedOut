import { describe, expect, it, vi } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { Damage } from './Damage';
import { Drone } from './Drone';
import { DroneDestroyed } from './DroneDestroyed';
import { DroneField } from './DroneField';
import { MassiveAsteroid } from './MassiveAsteroid';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import type { PhysicsBody } from './PhysicsBody';
import { Ship } from './Ship';

const emptyBelt = () => new AsteroidBelt({ x: 0, y: 0 }, []);
const emptyMassive = () => new MassiveAsteroidField({ x: 0, y: 0 }, 18, []);

describe('DroneField', () => {
  it('REQ-48 attaches drones to every regular-asteroid size tier', () => {
    const small = new Asteroid(1, { x: 2000, y: 0 }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const medium = new Asteroid(2, { x: 0, y: 2000 }, { x: 0, y: 0 }, 38, 0, 0, [1, 1, 1], 0.5);
    const large = new Asteroid(3, { x: -2000, y: 0 }, { x: 0, y: 0 }, 55, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [small, medium, large]);
    const ship = new Ship();
    const field = new DroneField();

    field.update(0, ship, belt, emptyMassive(), 0);

    const hosts: PhysicsBody[] = [];
    field.forEach((drone) => { if (drone.host) hosts.push(drone.host); });
    expect(hosts).toContain(small);
    expect(hosts).toContain(medium);
    expect(hosts).toContain(large);
  });

  it('REQ-48 attaches drones to massive asteroids using their irregular outline', () => {
    const massive = new MassiveAsteroid(1, { x: 400, y: 0 }, 100, 0, [1, 0.4, 1, 1, 1, 1], [], 0.5);
    const massiveField = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [massive]);
    const ship = new Ship();
    const drone = new Drone(massive, 0, [1, 1, 1], 2);
    const field = new DroneField([drone]);

    field.update(0, ship, emptyBelt(), massiveField, 0);

    expect(drone.host).toBe(massive);
    const surface = massiveField.boundaryRadiusAt(massive, { x: massive.position.x + 100, y: massive.position.y });
    expect(drone.position.x).toBeCloseTo(massive.position.x + surface + drone.radius * 0.4, 1);
  });

  it('REQ-48 rides an attached drone on its host surface until the player approaches', () => {
    const asteroid = new Asteroid(1, { x: 400, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const ship = new Ship();
    const drone = new Drone(asteroid, 0, [1, 1, 1], 2);
    const field = new DroneField([drone]);

    field.update(0.02, ship, belt, emptyMassive(), 0);

    expect(drone.host).toBe(asteroid);
    expect(drone.position.x).toBeCloseTo(asteroid.position.x + asteroid.radius + drone.radius * 0.4, 1);
  });

  it('REQ-48 detaches and accelerates toward the ship when the player is within range', () => {
    const asteroid = new Asteroid(1, { x: 200, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const ship = new Ship();
    const drone = new Drone(asteroid, Math.PI, [1, 1, 1], 2);
    const field = new DroneField([drone]);

    field.update(0.02, ship, belt, emptyMassive(), 0);
    expect(drone.isHunting).toBe(true);

    const beforeX = drone.position.x;
    field.update(0.5, ship, belt, emptyMassive(), 0);
    expect(drone.position.x).toBeLessThan(beforeX);
  });

  it('REQ-48 releases a drone to hunt when its host asteroid is destroyed', () => {
    const asteroid = new Asteroid(1, { x: 400, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const ship = new Ship();
    const drone = new Drone(asteroid, 0, [1, 1, 1], 2);
    const field = new DroneField([drone]);

    belt.applyLaserHit(asteroid, { ...asteroid.position });
    field.update(0.02, ship, belt, emptyMassive(), 0);

    expect(drone.isHunting).toBe(true);
  });

  it('REQ-48 damages the ship and self-destructs on impact, respecting invulnerability', () => {
    const ship = new Ship();
    const drone = new Drone(null, 0, [1, 1, 1], 2);
    drone.position = { x: ship.radius + drone.radius - 1, y: 0 };
    const damages: Damage[] = [];
    const field = new DroneField([drone]);
    field.addDamageObserver({ onDamage: (damage) => damages.push(damage) });

    const hpBefore = ship.hp;
    field.update(0.02, ship, emptyBelt(), emptyMassive(), 0);

    expect(ship.hp).toBeLessThan(hpBefore);
    expect(damages).toHaveLength(1);
    expect(field.has(drone)).toBe(false);

    const second = new Drone(null, 0, [1, 1, 1], 2);
    second.position = { x: ship.radius + second.radius - 1, y: 0 };
    const field2 = new DroneField([second]);
    const hpMid = ship.hp;
    field2.update(0.02, ship, emptyBelt(), emptyMassive(), 0);

    expect(ship.hp).toBe(hpMid);
    expect(field2.has(second)).toBe(false);
  });

  it('REQ-48 takes one to three laser hits to kill a drone', () => {
    const drone = new Drone(null, 0, [1, 1, 1], 3);
    const field = new DroneField([drone]);
    const events: DroneDestroyed[] = [];
    field.addDroneDestroyedObserver({ onDroneDestroyed: (event) => events.push(event) });
    const position = { ...drone.position };

    field.applyLaserHit(drone, position);
    expect(field.has(drone)).toBe(true);
    field.applyLaserHit(drone, position);
    expect(field.has(drone)).toBe(true);
    field.applyLaserHit(drone, position);
    expect(field.has(drone)).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0].position).toEqual(position);

    const tough = new Drone(null, 0, [1, 1, 1], 1);
    const field2 = new DroneField([tough]);
    field2.applyLaserHit(tough, { ...tough.position });
    expect(field2.has(tough)).toBe(false);
  });

  it('REQ-48 spawns drones attached to asteroids beyond the visible boundary', () => {
    const asteroid = new Asteroid(1, { x: 2000, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const ship = new Ship();
    const field = new DroneField();

    field.update(0, ship, belt, emptyMassive(), 0);

    let dronePosition: { x: number; y: number } | null = null;
    field.forEach((drone) => { if (drone.host === asteroid) dronePosition = drone.position; });
    expect(dronePosition).not.toBeNull();
    expect(Math.hypot(dronePosition!.x, dronePosition!.y)).toBeGreaterThan(1050);
  });

  it('REQ-48 recycles hunting drones that drift beyond the recycle boundary', () => {
    const ship = new Ship();
    const drone = new Drone(null, 0, [1, 1, 1], 2);
    drone.position = { x: 10000, y: 0 };
    const field = new DroneField([drone]);

    field.update(0.02, ship, emptyBelt(), emptyMassive(), 0);

    expect(field.has(drone)).toBe(false);
  });

  it('REQ-48 clusters up to a random capacity of drones on a single massive asteroid', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const massive = new MassiveAsteroid(1, { x: 2000, y: 0 }, 100, 0, [1, 1, 1, 1, 1, 1], [], 0.5);
    const massiveField = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [massive]);
    const belt = emptyBelt();
    const ship = new Ship();
    const field = new DroneField();

    field.update(0, ship, belt, massiveField, 0);

    let onMassive = 0;
    field.forEach((drone) => { if (drone.host === massive) onMassive++; });
    expect(onMassive).toBe(6);
    spy.mockRestore();
  });

  it('REQ-48 caps regular asteroids at one drone each', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const a = new Asteroid(1, { x: 2000, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [a]);
    const ship = new Ship();
    const field = new DroneField();

    field.update(0, ship, belt, emptyMassive(), 0);

    let onRegular = 0;
    field.forEach((drone) => { if (drone.host === a) onRegular++; });
    expect(onRegular).toBe(1);
    spy.mockRestore();
  });

  it('REQ-29 menace rises as drones get closer to the ship', () => {
    const ship = new Ship();
    const far = new Drone(null, 0, [1, 1, 1], 2);
    far.position = { x: 600, y: 0 };
    const near = new Drone(null, 0, [1, 1, 1], 2);
    near.position = { x: 100, y: 0 };
    const field = new DroneField([far]);

    const farMenace = field.menace(ship.position);
    field.forEach(() => {});
    const field2 = new DroneField([near]);
    const nearMenace = field2.menace(ship.position);

    expect(nearMenace).toBeGreaterThan(farMenace);
    expect(nearMenace).toBeGreaterThan(0);
    expect(nearMenace).toBeLessThanOrEqual(1);
  });

  it('REQ-29 menace saturates at one when many drones crowd the ship', () => {
    const ship = new Ship();
    const drones: Drone[] = [];
    for (let i = 0; i < 10; i++) {
      const drone = new Drone(null, 0, [1, 1, 1], 2);
      drone.position = { x: ship.position.x + i, y: ship.position.y };
      drones.push(drone);
    }
    const field = new DroneField(drones);

    expect(field.menace(ship.position)).toBe(1);
  });
});

