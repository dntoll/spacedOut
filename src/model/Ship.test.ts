import { describe, expect, it } from 'vitest';
import { Ship } from './Ship';

describe('Ship controls', () => {
  it('REQ-06 turns directly toward the target position', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    expect(ship.angle).toBeCloseTo(0);
  });

  it('REQ-07 accelerates toward the target while dampening non-forward momentum', () => {
    const ship = new Ship();
    ship.velocity = { x: 0, y: 25 };
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    ship.applyControls(0.1);
    expect(ship.velocity.x).toBeGreaterThan(0);
    expect(ship.velocity.y).toBeGreaterThan(0);
    expect(ship.velocity.y).toBeLessThan(25);
  });

  it('REQ-08 produces more thrust for a distant target', () => {
    const near = new Ship();
    near.aimAt({ x: 30, y: 0 });
    near.startThrust();
    const far = new Ship();
    far.aimAt({ x: 500, y: 0 });
    far.startThrust();
    expect(far.thrustAmount).toBeGreaterThan(near.thrustAmount);
  });

  it('REQ-16 consumes fuel while thrusting', () => {
    const ship = new Ship();
    ship.velocity = { x: 200, y: 0 };
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    const fuelBefore = ship.fuel;
    ship.applyControls(1);
    expect(ship.fuel).toBeLessThan(fuelBefore);
  });

  it('REQ-33 tracks hull hit-points, damage, and repair', () => {
    const ship = new Ship();
    expect(ship.hp).toBe(100);
    ship.takeDamage(30);
    expect(ship.hp).toBe(70);
    ship.takeDamage(50);
    expect(ship.hp).toBe(20);
    ship.repair(40);
    expect(ship.hp).toBe(60);
    ship.repair(200);
    expect(ship.hp).toBe(100);
  });

  it('REQ-40 tracks ammo, collection, and consumption', () => {
    const ship = new Ship();
    expect(ship.ammo).toBe(100);
    ship.consumeAmmo(30);
    expect(ship.ammo).toBe(70);
    expect(ship.consumeAmmo(80)).toBe(false);
    expect(ship.ammo).toBe(70);
    ship.collectAmmo(50);
    expect(ship.ammo).toBe(100);
  });

  it('REQ-42 regenerates one unit of ammo and fuel every two seconds when at zero', () => {
    const ship = new Ship();
    ship.consumeAmmo(100);
    expect(ship.ammo).toBe(0);
    ship.updateEmergencyReload(1.9);
    expect(ship.ammo).toBe(0);
    ship.updateEmergencyReload(0.2);
    expect(ship.ammo).toBe(1);
    ship.updateEmergencyReload(2);
    expect(ship.ammo).toBe(1);

    ship.setControlTuning({ dampening: 1.5, thrustAccel: 170, maxSpeed: 100000 });
    ship.aimAt({ x: 100000, y: 0 });
    ship.startThrust();
    for (let i = 0; i < 300 && ship.fuel > 0; i++) ship.applyControls(0.1);
    expect(ship.fuel).toBe(0);
    ship.updateEmergencyReload(1.9);
    expect(ship.fuel).toBe(0);
    ship.updateEmergencyReload(0.2);
    expect(ship.fuel).toBe(1);
  });

  it('REQ-35 becomes invulnerable for 0.5s after taking damage', () => {
    const ship = new Ship();
    expect(ship.isInvulnerable).toBe(false);
    ship.takeDamage(10);
    expect(ship.isInvulnerable).toBe(true);
    ship.updateInvulnerability(0.4);
    expect(ship.isInvulnerable).toBe(true);
    ship.updateInvulnerability(0.2);
    expect(ship.isInvulnerable).toBe(false);
  });

  it('REQ-36 dies when hit-points reach zero', () => {
    const ship = new Ship();
    expect(ship.isAlive).toBe(true);
    ship.takeDamage(100);
    expect(ship.hp).toBe(0);
    expect(ship.isAlive).toBe(false);
  });

  it('REQ-26 dampens lateral velocity more at higher dampening rates', () => {
    const soft = new Ship();
    soft.setControlTuning({ dampening: 0.5, thrustAccel: 0, maxSpeed: 650 });
    soft.velocity = { x: 0, y: 100 };
    soft.aimAt({ x: 500, y: 0 });
    soft.startThrust();
    soft.applyControls(0.1);

    const hard = new Ship();
    hard.setControlTuning({ dampening: 5, thrustAccel: 0, maxSpeed: 650 });
    hard.velocity = { x: 0, y: 100 };
    hard.aimAt({ x: 500, y: 0 });
    hard.startThrust();
    hard.applyControls(0.1);

    expect(hard.velocity.y).toBeLessThan(soft.velocity.y);
  });

  it('REQ-26 dampens reverse velocity toward zero while thrusting', () => {
    const ship = new Ship();
    ship.setControlTuning({ dampening: 5, thrustAccel: 0, maxSpeed: 650 });
    ship.velocity = { x: -100, y: 0 };
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    ship.applyControls(0.1);
    expect(ship.velocity.x).toBeGreaterThan(-100);
    expect(ship.velocity.x).toBeLessThan(0);
  });

  it('REQ-26 preserves lateral momentum when dampening is zero', () => {
    const ship = new Ship();
    ship.setControlTuning({ dampening: 0, thrustAccel: 170, maxSpeed: 650 });
    ship.velocity = { x: 0, y: 25 };
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    ship.applyControls(0.1);
    expect(ship.velocity.y).toBeCloseTo(25, 5);
  });

  it('REQ-37 ramps directional thrust up while held and down when released', () => {
    const ship = new Ship();
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    ship.setDirectionalThrust({ x: 1, y: 0 });
    ship.applyControls(0.1);
    expect(ship.directionalThrust?.level).toBeGreaterThan(0);
    expect(ship.directionalThrust?.level).toBeLessThan(1);
    ship.applyControls(0.3);
    expect(ship.directionalThrust?.level).toBeCloseTo(1, 1);
    ship.setDirectionalThrust(null);
    ship.applyControls(0.1);
    expect(ship.directionalThrust).toBeNull();
  });

  it('REQ-37 thrusts forward along the ship axis when W is held', () => {
    const ship = new Ship();
    ship.setControlTuning({ dampening: 0, thrustAccel: 100, maxSpeed: 650 });
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    ship.setDirectionalThrust({ x: 1, y: 0 });
    for (let i = 0; i < 10; i++) ship.applyControls(0.1);
    expect(ship.velocity.x).toBeGreaterThan(0);
    expect(ship.velocity.y).toBeCloseTo(0, 4);
  });

  it('REQ-37 thrusts sideways when A is held', () => {
    const ship = new Ship();
    ship.setControlTuning({ dampening: 0, thrustAccel: 100, maxSpeed: 650 });
    ship.aimAt({ x: 100, y: 0 });
    ship.applyControls(0);
    ship.setDirectionalThrust({ x: 0, y: -1 });
    for (let i = 0; i < 10; i++) ship.applyControls(0.1);
    expect(ship.velocity.y).toBeLessThan(0);
  });

  it('REQ-52 starts at custom initial resource levels while the default stays full', () => {
    const ship = new Ship({ fuel: 50, hp: 50, ammo: 50 });
    expect(ship.fuel).toBe(50);
    expect(ship.hp).toBe(50);
    expect(ship.ammo).toBe(50);

    const fresh = new Ship();
    expect(fresh.fuel).toBe(100);
    expect(fresh.hp).toBe(100);
    expect(fresh.ammo).toBe(100);
  });

  it('REQ-69 upgrades the weapon level in two steps and caps at two', () => {
    const ship = new Ship();
    expect(ship.weaponLevel).toBe(0);
    ship.upgradeWeapon();
    expect(ship.weaponLevel).toBe(1);
    ship.upgradeWeapon();
    expect(ship.weaponLevel).toBe(2);
    ship.upgradeWeapon();
    expect(ship.weaponLevel).toBe(2);
  });

  it('REQ-89 charges the shield from fuel only while idle, five full shields per tank', () => {
    const ship = new Ship();
    expect(ship.hasShield).toBe(false);
    ship.updateShieldCharge(10);
    expect(ship.shield).toBe(0);
    expect(ship.fuel).toBe(100);

    ship.installShield();
    expect(ship.hasShield).toBe(true);

    let restores = 0;
    for (let i = 0; i < 5; i++) {
      for (let step = 0; step < 100 && ship.shield < ship.shieldCapacity; step++) ship.updateShieldCharge(0.1);
      expect(ship.shield).toBe(ship.shieldCapacity);
      restores++;
      ship.takeDamage(ship.shieldCapacity);
      ship.updateShieldCharge(2);
    }
    expect(restores).toBe(5);
    expect(ship.fuel).toBe(0);
  });

  it('REQ-89 pauses shield charging while the ship is thrusting', () => {
    const ship = new Ship();
    ship.installShield();
    ship.velocity = { x: 200, y: 0 };
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    ship.applyControls(0.1);
    ship.updateShieldCharge(1);
    expect(ship.shield).toBe(0);

    ship.stopThrust();
    ship.setDirectionalThrust(null);
    ship.applyControls(0.5);
    ship.updateShieldCharge(1);
    expect(ship.shield).toBeGreaterThan(0);
  });

  it('REQ-89 absorbs damage in the shield and spills the excess into the hull', () => {
    const ship = new Ship();
    ship.installShield();
    ship.updateShieldCharge(4);
    expect(ship.shield).toBe(100);

    ship.takeDamage(30);
    expect(ship.shield).toBe(70);
    expect(ship.hp).toBe(100);

    ship.takeDamage(90);
    expect(ship.shield).toBe(0);
    expect(ship.hp).toBe(80);
  });

  it('REQ-89 waits before recharging after a shielded hit and never eats the emergency fuel', () => {
    const ship = new Ship();
    ship.installShield();
    ship.updateShieldCharge(4);
    ship.takeDamage(50);
    expect(ship.shield).toBe(50);
    ship.updateShieldCharge(1);
    expect(ship.shield).toBe(50);
    ship.updateShieldCharge(1);
    expect(ship.shield).toBeGreaterThan(50);

    ship.setControlTuning({ dampening: 1.5, thrustAccel: 170, maxSpeed: 100000 });
    ship.aimAt({ x: 100000, y: 0 });
    ship.startThrust();
    for (let i = 0; i < 300 && ship.fuel > 0; i++) ship.applyControls(0.1);
    expect(ship.fuel).toBe(0);
    ship.stopThrust();
    ship.setDirectionalThrust(null);
    ship.applyControls(0.5);
    ship.updateEmergencyReload(2.1);
    expect(ship.fuel).toBe(1);
    ship.updateShieldCharge(2);
    expect(ship.fuel).toBe(1);

    ship.collectFuel(20);
    ship.updateShieldCharge(2);
    expect(ship.fuel).toBeLessThan(21);
  });

  it('REQ-82 thrust is free below speed 100 and flags free thrust', () => {
    const ship = new Ship();
    ship.velocity = { x: 50, y: 0 };
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    const fuelBefore = ship.fuel;
    ship.applyControls(0.5);
    expect(ship.fuel).toBe(fuelBefore);
    expect(ship.freeThrust).toBe(true);
  });

  it('REQ-83 brakes to a full stop when slow and idle for two seconds', () => {
    const ship = new Ship();
    ship.velocity = { x: 20, y: 0 };
    ship.aimAt({ x: 0, y: -100 });
    for (let i = 0; i < 30; i++) ship.applyControls(0.1);
    expect(ship.speed).toBeLessThan(1);
    expect(ship.velocity).toEqual({ x: 0, y: 0 });
  });

  it('REQ-83 does not brake while thrust is applied within the idle window', () => {
    const ship = new Ship();
    ship.velocity = { x: 20, y: 0 };
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    for (let i = 0; i < 30; i++) ship.applyControls(0.1);
    expect(ship.speed).toBeGreaterThan(0);
  });

  it('REQ-83 does not brake when idle but speed is at or above 30', () => {
    const ship = new Ship();
    ship.velocity = { x: 200, y: 0 };
    ship.aimAt({ x: 0, y: -100 });
    for (let i = 0; i < 30; i++) ship.applyControls(0.1);
    expect(ship.speed).toBeGreaterThanOrEqual(30);
  });

  it('REQ-84 consumes no fuel for forward thrust at top speed', () => {
    const ship = new Ship();
    ship.setControlTuning({ dampening: 0, thrustAccel: 170, maxSpeed: 1000 });
    ship.velocity = { x: 1000, y: 0 };
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    const fuelBefore = ship.fuel;
    ship.applyControls(0.5);
    expect(ship.fuel).toBe(fuelBefore);
    expect(ship.freeThrust).toBe(true);
  });

  it('REQ-84 consumes fuel for corrective thrust at top speed', () => {
    const ship = new Ship();
    ship.setControlTuning({ dampening: 0, thrustAccel: 170, maxSpeed: 1000 });
    ship.velocity = { x: 1000, y: 0 };
    ship.aimAt({ x: 0, y: 500 });
    ship.startThrust();
    const fuelBefore = ship.fuel;
    ship.applyControls(0.5);
    expect(ship.fuel).toBeLessThan(fuelBefore);
    expect(ship.freeThrust).toBe(false);
  });

  it('REQ-84 treats near-top forward speed as free despite float dips', () => {
    const ship = new Ship();
    ship.setControlTuning({ dampening: 0, thrustAccel: 170, maxSpeed: 1000 });
    ship.velocity = { x: 999.5, y: 0 };
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    const fuelBefore = ship.fuel;
    ship.applyControls(0.5);
    expect(ship.fuel).toBe(fuelBefore);
    expect(ship.freeThrust).toBe(true);
  });
});
