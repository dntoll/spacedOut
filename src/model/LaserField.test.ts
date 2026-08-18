import { describe, expect, it } from 'vitest';
import { Asteroid } from './Asteroid';
import { AsteroidBelt } from './AsteroidBelt';
import { Collision } from './Collision';
import { LaserField } from './LaserField';
import { LaserShot } from './LaserShot';
import { MassiveAsteroid } from './MassiveAsteroid';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import { Ship } from './Ship';

const emptyBelt = () => new AsteroidBelt({ x: 0, y: 0 }, []);
const emptyMassiveField = () => new MassiveAsteroidField({ x: 0, y: 0 }, 18, []);

describe('LaserField', () => {
  it('REQ-39 fires a laser traveling forward from the ship nose', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    expect(ship.angle).toBeCloseTo(0);
    const field = new LaserField();

    field.fire(ship);

    let count = 0;
    let velocityX = 0;
    let positionX = 0;
    field.forEach((laser) => { count++; velocityX = laser.velocity.x; positionX = laser.position.x; });
    expect(count).toBe(1);
    expect(velocityX).toBeGreaterThan(0);
    expect(positionX).toBeGreaterThan(0);
  });

  it('REQ-39 auto-fires at a fixed rate while held and consumes ammo per shot', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    const field = new LaserField();
    const belt = emptyBelt();
    const massive = emptyMassiveField();

    field.fire(ship);
    field.fire(ship);
    let count = 0;
    field.forEach(() => count++);
    expect(count).toBe(1);

    field.update(0.18, ship, belt, massive);
    field.fire(ship);
    count = 0;
    field.forEach(() => count++);
    expect(count).toBe(2);
    expect(ship.ammo).toBeLessThan(100);
  });

  it('REQ-39 does not fire when ammo is fully depleted', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    ship.consumeAmmo(100);
    expect(ship.ammo).toBe(0);
    const field = new LaserField();

    field.fire(ship);

    let count = 0;
    field.forEach(() => count++);
    expect(count).toBe(0);
  });

  it('REQ-43 uses the irregular outline, not the bounding circle, for massive-asteroid laser hits', () => {
    const massive = new MassiveAsteroid(1, { x: 0, y: 0 }, 100, 0, [1, 0.4, 1, 1, 1, 1], [], 0.5);
    const field = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [massive]);
    const belt = emptyBelt();
    const ship = new Ship();
    const concaveAngle = Math.PI / 3;
    ship.position = { x: Math.cos(concaveAngle) * 70, y: Math.sin(concaveAngle) * 70 };
    ship.aimAt({ x: 0, y: 0 });
    ship.applyControls(0);
    const lasers = new LaserField();

    lasers.fire(ship);
    lasers.update(0, ship, belt, field);

    let count = 0;
    lasers.forEach(() => count++);
    expect(count).toBe(1);
  });

  it('REQ-44 despawns laser shots that leave the visible screen', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    const field = new LaserField();

    field.fire(ship);
    field.update(0.2, ship, emptyBelt(), emptyMassiveField(), 100);

    let count = 0;
    field.forEach(() => count++);
    expect(count).toBe(0);
  });

  it('REQ-44 keeps laser shots alive while still on screen, even at high speed and long flight time', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    const field = new LaserField();

    field.fire(ship);
    // Large cull radius simulates a zoomed-out high-speed view; the laser must
    // survive far past any fixed lifetime because it has not left the screen.
    field.update(1.0, ship, emptyBelt(), emptyMassiveField(), 5000);

    let count = 0;
    field.forEach(() => count++);
    expect(count).toBe(1);
  });

  it('REQ-41 destroys a regular asteroid on hit and emits a spark', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    const asteroid = new Asteroid(1, { x: 60, y: 0 }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const massive = emptyMassiveField();
    const field = new LaserField();
    const sparks: Collision[] = [];
    field.addCollisionObserver({ onCollision: (collision) => sparks.push(collision) });

    field.fire(ship);
    field.update(0.02, ship, belt, massive);

    let laserCount = 0;
    field.forEach(() => laserCount++);
    expect(laserCount).toBe(0);
    let asteroidCount = 0;
    belt.forEach(() => asteroidCount++);
    expect(asteroidCount).toBe(0);
    expect(sparks).toHaveLength(1);
  });

  it('REQ-41 leaves massive asteroids unaffected, emitting only a spark', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    const massiveAsteroid = new MassiveAsteroid(1, { x: 60, y: 0 }, 100, 0, [1, 1, 1], [], 0.5);
    const belt = emptyBelt();
    const massive = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [massiveAsteroid]);
    const field = new LaserField();
    const sparks: Collision[] = [];
    field.addCollisionObserver({ onCollision: (collision) => sparks.push(collision) });

    field.fire(ship);
    field.update(0.02, ship, belt, massive);

    let laserCount = 0;
    field.forEach(() => laserCount++);
    expect(laserCount).toBe(0);
    let massiveCount = 0;
    massive.forEachActive(() => massiveCount++);
    expect(massiveCount).toBe(1);
    expect(massiveAsteroid.position).toEqual({ x: 60, y: 0 });
    expect(sparks).toHaveLength(1);
  });

  it('REQ-45 emits a LaserShot event only when a laser is actually fired', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    const field = new LaserField();
    const shots: LaserShot[] = [];
    field.addLaserShotObserver({ onLaserShot: (event) => shots.push(event) });

    field.fire(ship);
    field.fire(ship); // blocked by cooldown

    expect(shots).toHaveLength(1);
  });

  it('REQ-45 does not emit a LaserShot when ammo is depleted', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    ship.consumeAmmo(100);
    const field = new LaserField();
    const shots: LaserShot[] = [];
    field.addLaserShotObserver({ onLaserShot: (event) => shots.push(event) });

    field.fire(ship);

    expect(shots).toHaveLength(0);
  });

  it('REQ-45 emits a LaserImpact when a laser hits a regular asteroid', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    const asteroid = new Asteroid(1, { x: 60, y: 0 }, { x: 0, y: 0 }, 20, 0, 0, [1, 1, 1], 0.5);
    const belt = new AsteroidBelt({ x: 0, y: 0 }, [asteroid]);
    const field = new LaserField();
    const impacts: Collision[] = [];
    field.addLaserImpactObserver({ onLaserImpact: (collision) => impacts.push(collision) });

    field.fire(ship);
    field.update(0.02, ship, belt, emptyMassiveField());

    expect(impacts).toHaveLength(1);
  });

  it('REQ-45 emits a LaserImpact when a laser hits a massive asteroid', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    const massiveAsteroid = new MassiveAsteroid(1, { x: 60, y: 0 }, 100, 0, [1, 1, 1], [], 0.5);
    const massive = new MassiveAsteroidField({ x: 0, y: 0 }, 18, [massiveAsteroid]);
    const field = new LaserField();
    const impacts: Collision[] = [];
    field.addLaserImpactObserver({ onLaserImpact: (collision) => impacts.push(collision) });

    field.fire(ship);
    field.update(0.02, ship, emptyBelt(), massive);

    expect(impacts).toHaveLength(1);
  });

  it('REQ-69 fires one, two, then three forward lasers as the weapon level rises', () => {
    const countAt = (level: number): number => {
      const ship = new Ship();
      ship.aimAt({ x: 100, y: 0 });
      ship.applyControls(0);
      for (let i = 0; i < level; i++) ship.upgradeWeapon();
      const field = new LaserField();
      field.fire(ship);
      let count = 0;
      field.forEach(() => count++);
      return count;
    };

    expect(countAt(0)).toBe(1);
    expect(countAt(1)).toBe(2);
    expect(countAt(2)).toBe(3);
  });

  it('REQ-69 fires wing lasers parallel to the nose with lateral offsets', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    ship.upgradeWeapon();
    ship.upgradeWeapon();
    const field = new LaserField();
    field.fire(ship);

    const lasers: { x: number; y: number; vx: number; angle: number }[] = [];
    field.forEach((laser) => lasers.push({
      x: laser.position.x,
      y: laser.position.y,
      vx: laser.velocity.x,
      angle: laser.angle,
    }));

    expect(lasers).toHaveLength(3);
    for (const laser of lasers) {
      expect(laser.vx).toBeGreaterThan(0);
      expect(laser.angle).toBeCloseTo(ship.angle, 6);
    }
    const ys = lasers.map((laser) => laser.y).sort((a, b) => a - b);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
  });

  it('REQ-69 consumes one ammo per volley regardless of weapon level', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    ship.upgradeWeapon();
    ship.upgradeWeapon();
    const ammoBefore = ship.ammo;
    const field = new LaserField();

    field.fire(ship);

    expect(ship.ammo).toBe(ammoBefore - 1);
  });
});
