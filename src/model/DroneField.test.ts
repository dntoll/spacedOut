import { describe, expect, it, vi } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { Collision } from './Collision';
import { Damage } from './Damage';
import { Drone } from './Drone';
import { DroneDestroyed } from './DroneDestroyed';
import { DroneField } from './DroneField';
import { MassiveAsteroid } from './MassiveAsteroid';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import { Pirate } from './Pirate';
import type { PhysicsBody } from './PhysicsBody';
import { Ship } from './Ship';
import { SpaceStation } from './SpaceStation';
import { length, sub } from '../math';

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

  it('REQ-64 does not attach mining drones to the abandoned destination station', () => {
    const station = new SpaceStation({ x: 2000, y: 0 }, 1000, 0);
    const massiveField = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [station]);
    const field = new DroneField();

    field.update(0, new Ship(), emptyBelt(), massiveField, 0);

    expect(field.count).toBe(0);
  });

  it('REQ-64 does not attract a hunting mining drone to re-home on the destination station', () => {
    const station = new SpaceStation({ x: 1600, y: 0 }, 1000, 0);
    const massiveField = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [station]);
    const formerHost = new Asteroid(1, { x: 1500, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const drone = new Drone(formerHost, 0, [1, 1, 1], 2);
    drone.detach();
    drone.position = { x: 1500, y: 0 };
    const field = new DroneField([drone]);

    field.update(0, new Ship(), emptyBelt(), massiveField, 0, false);

    expect(field.has(drone)).toBe(false);
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

  it('REQ-48 a drone that survives a laser hit instantly becomes a hunter', () => {
    const asteroid = new Asteroid(1, { x: 400, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const ship = new Ship();
    const drone = new Drone(asteroid, 0, [1, 1, 1], 3);
    const field = new DroneField([drone]);
    field.update(0, ship, belt, emptyMassive(), 0);
    expect(drone.host).toBe(asteroid);

    field.applyLaserHit(drone, { ...drone.position });

    expect(field.has(drone)).toBe(true);
    expect(drone.isHunting).toBe(true);
    expect(drone.hp).toBe(2);
  });

  it('REQ-48 firing on the same screen as an attached drone awakens it', () => {
    const ship = new Ship();
    const asteroid = new Asteroid(1, { x: 600, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const onScreen = new Drone(asteroid, 0, [1, 1, 1], 2);
    const field = new DroneField([onScreen]);
    field.update(0, ship, belt, emptyMassive(), 0);
    expect(onScreen.host).toBe(asteroid);

    field.awakenNearby(ship, 1000);

    expect(onScreen.isHunting).toBe(true);
  });

  it('REQ-48 leaves attached drones beyond the screen asleep when firing', () => {
    const ship = new Ship();
    const asteroid = new Asteroid(1, { x: 2000, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const offScreen = new Drone(asteroid, 0, [1, 1, 1], 2);
    const field = new DroneField([offScreen]);
    field.update(0, ship, belt, emptyMassive(), 0);

    field.awakenNearby(ship, 1000);

    expect(offScreen.isHunting).toBe(false);
    expect(offScreen.host).toBe(asteroid);
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

  it('REQ-29 anyHunting is false when every drone is still attached to a host', () => {
    const host = new Asteroid(1, { x: 2000, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const attached = new Drone(host, 0, [1, 1, 1], 2);
    const field = new DroneField([attached]);

    expect(field.anyHunting()).toBe(false);
  });

  it('REQ-29 anyHunting is true once a drone has detached and is pursuing the ship', () => {
    const ship = new Ship();
    const hunter = new Drone(null, 0, [1, 1, 1], 2);
    hunter.position = { x: 2000, y: 0 };
    const field = new DroneField([hunter]);

    expect(field.anyHunting()).toBe(true);
  });

  it('REQ-58 keeps hunting while within the give-up distance', () => {
    const ship = new Ship();
    const asteroid = new Asteroid(1, { x: 2400, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const hunter = new Drone(null, 0, [1, 1, 1], 2);
    hunter.position = { x: 1000, y: 0 };
    const field = new DroneField([hunter]);

    field.update(0, ship, belt, emptyMassive(), 0, false);

    expect(hunter.isHunting).toBe(true);
    expect(hunter.reHomeTarget).toBeNull();
    expect(field.has(hunter)).toBe(true);
  });

  it('REQ-58 starts re-homing toward the nearest asteroid when outrun beyond the give-up distance', () => {
    const ship = new Ship();
    const near = new Asteroid(1, { x: 2400, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const far = new Asteroid(1, { x: -3000, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [near, far]);
    const hunter = new Drone(null, 0, [1, 1, 1], 2);
    hunter.position = { x: 1250, y: 0 };
    const field = new DroneField([hunter]);

    field.update(0, ship, belt, emptyMassive(), 0, false);

    expect(field.has(hunter)).toBe(true);
    expect(hunter.isHunting).toBe(false);
    expect(hunter.reHomeTarget).toBe(near);
  });

  it('REQ-58 a re-homing drone attaches to its target on arrival', () => {
    const ship = new Ship();
    const asteroid = new Asteroid(1, { x: 1300, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const hunter = new Drone(null, 0, [1, 1, 1], 2);
    hunter.position = { x: 1250, y: 0 };
    const field = new DroneField([hunter]);

    field.update(0, ship, belt, emptyMassive(), 0, false);
    expect(hunter.reHomeTarget).toBe(asteroid);

    field.update(0.02, ship, belt, emptyMassive(), 0, false);

    expect(hunter.host).toBe(asteroid);
    expect(hunter.reHomeTarget).toBeNull();
    expect(hunter.isHunting).toBe(false);
  });

  it('REQ-58 anyHunting is false while a drone is re-homing', () => {
    const ship = new Ship();
    const asteroid = new Asteroid(1, { x: 2400, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const hunter = new Drone(null, 0, [1, 1, 1], 2);
    hunter.position = { x: 1250, y: 0 };
    const field = new DroneField([hunter]);

    field.update(0, ship, belt, emptyMassive(), 0, false);

    expect(field.anyHunting()).toBe(false);
  });

  it('REQ-58 re-homing drones do not count toward the spawn population cap', () => {
    const ship = new Ship();
    const target = new Asteroid(1, { x: 2000, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const free = new Asteroid(1, { x: -2000, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [target, free]);
    const rehomers: Drone[] = [];
    for (let i = 0; i < 24; i++) {
      const drone = new Drone(null, 0, [1, 1, 1], 2);
      drone.position = { x: 1500, y: 0 };
      drone.startReHoming(target);
      rehomers.push(drone);
    }
    const field = new DroneField(rehomers);

    field.update(0, ship, belt, emptyMassive(), 0, true);

    let onFree = 0;
    field.forEach((drone) => { if (drone.host === free) onFree++; });
    expect(onFree).toBe(1);
  });

  it('REQ-58 a re-homing drone reserves its target asteroid against double-assignment', () => {
    const ship = new Ship();
    const target = new Asteroid(1, { x: 2000, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const free = new Asteroid(1, { x: -2000, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [target, free]);
    const rehoming = new Drone(null, 0, [1, 1, 1], 2);
    rehoming.position = { x: 1500, y: 0 };
    rehoming.startReHoming(target);
    const field = new DroneField([rehoming]);

    field.update(0, ship, belt, emptyMassive(), 0, true);

    let referencesTarget = 0;
    let attachedToTarget = 0;
    let attachedToFree = 0;
    field.forEach((drone) => {
      if (drone.reHomeTarget === target || drone.host === target) referencesTarget++;
      if (drone.host === target) attachedToTarget++;
      if (drone.host === free) attachedToFree++;
    });
    expect(referencesTarget).toBe(1);
    expect(attachedToTarget).toBe(0);
    expect(attachedToFree).toBe(1);
  });

  it('REQ-12 hunting drones bounce off regular asteroids and emit a collision', () => {
    const ship = new Ship();
    ship.position = { x: 5000, y: 0 };
    const drone = new Drone(null, 0, [1, 1, 1], 2);
    drone.position = { x: 40, y: 0 };
    drone.velocity = { x: -40, y: 0 };
    const asteroid = new Asteroid(1, { x: 0, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const field = new DroneField([drone]);
    const collisions: Collision[] = [];
    field.addCollisionObserver({ onCollision: (c) => collisions.push(c) });

    field.update(0, ship, belt, emptyMassive(), 1500, false);

    expect(collisions.length).toBeGreaterThan(0);
    expect(drone.velocity.x).toBeGreaterThan(-40);
  });

  it('REQ-12 hunting drones crash-destroy on high-speed impact with a regular asteroid', () => {
    const ship = new Ship();
    ship.position = { x: 5000, y: 0 };
    const drone = new Drone(null, 0, [1, 1, 1], 1);
    drone.position = { x: 40, y: 0 };
    drone.velocity = { x: -1000, y: 0 };
    const asteroid = new Asteroid(1, { x: 0, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const field = new DroneField([drone]);
    const events: DroneDestroyed[] = [];
    field.addDroneDestroyedObserver({ onDroneDestroyed: (e) => events.push(e) });

    field.update(0, ship, belt, emptyMassive(), 1500, false);

    expect(field.has(drone)).toBe(false);
    expect(events).toHaveLength(1);
  });

  it('REQ-12 attached drones are unaffected by asteroid collisions', () => {
    const ship = new Ship();
    ship.position = { x: 5000, y: 0 };
    const asteroid = new Asteroid(1, { x: 0, y: 0 }, { x: 0, y: 0 }, 30, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const drone = new Drone(asteroid, 0, [1, 1, 1], 2);
    const field = new DroneField([drone]);
    const collisions: Collision[] = [];
    field.addCollisionObserver({ onCollision: (c) => collisions.push(c) });

    field.update(0, ship, belt, emptyMassive(), 1500, false);

    expect(collisions.length).toBe(0);
    expect(field.has(drone)).toBe(true);
  });

  it('REQ-12 repulses hunting drones from pirates and other drones so they do not overlap', () => {
    const droneA = new Drone(null, 0, [1, 1, 1], 2);
    droneA.position = { x: 0, y: 0 };
    const droneB = new Drone(null, 0, [1, 1, 1], 2);
    droneB.position = { x: 20, y: 0 };
    const pirate = new Pirate({ x: 10, y: 0 }, [1, 1, 1], 3);
    const field = new DroneField([droneA, droneB]);

    field.applySeparation([pirate], 0.016);

    expect(length(sub(droneA.position, droneB.position))).toBeGreaterThan(20);
  });

  it('REQ-73 spawns drones on asteroid islands during the second mission traversal', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, []);
    belt.update(0, { x: 0, y: 0 }, 1500, true, true, { x: 1, y: 0 });
    const ship = new Ship();
    const field = new DroneField();

    field.update(0, ship, belt, emptyMassive(), 0, false, true);

    let islandDroneCount = 0;
    let islandCenter: { x: number; y: number } | null = null;
    let islandRadius = 0;
    belt.forEachIsland((island) => {
      if (island.droneCount > 0) { islandCenter = island.center; islandRadius = island.radius; }
    });
    field.forEach((drone) => {
      if (drone.host && islandCenter && length(sub(drone.host.position, islandCenter)) <= islandRadius) {
        islandDroneCount++;
      }
    });
    expect(islandDroneCount).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it('REQ-73 does not double-spawn island drones across repeated updates', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, []);
    belt.update(0, { x: 0, y: 0 }, 1500, true, true, { x: 1, y: 0 });
    const ship = new Ship();
    const field = new DroneField();

    field.update(0, ship, belt, emptyMassive(), 0, false, true);
    const afterFirst = field.count;

    field.update(0, ship, belt, emptyMassive(), 0, false, true);

    expect(field.count).toBe(afterFirst);
    vi.restoreAllMocks();
  });

  it('REQ-73 island drones detach and hunt when the ship comes within range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, []);
    belt.update(0, { x: 0, y: 0 }, 1500, true, true, { x: 1, y: 0 });
    const ship = new Ship();
    const field = new DroneField();

    field.update(0, ship, belt, emptyMassive(), 0, false, true);
    const attached: Drone[] = [];
    field.forEach((drone) => { if (drone.host) attached.push(drone); });
    expect(attached.length).toBeGreaterThan(0);
    const hunter = attached[0];

    ship.position = { ...hunter.position };
    field.update(0.02, ship, belt, emptyMassive(), 0, false, true);

    expect(hunter.isHunting).toBe(true);
    vi.restoreAllMocks();
  });
});

