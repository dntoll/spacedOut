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
    ship.aimAt({ x: 500, y: 0 });
    ship.startThrust();
    const fuelBefore = ship.fuel;
    ship.applyControls(1);
    expect(ship.fuel).toBeLessThan(fuelBefore);
  });

  it('REQ-17 consumes air as time passes', () => {
    const ship = new Ship();
    const airBefore = ship.air;
    ship.updateLifeSupport(10);
    expect(ship.air).toBeLessThan(airBefore);
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
});
