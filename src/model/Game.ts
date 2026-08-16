import type { Vec2 } from '../types';
import { AsteroidBelt } from './AsteroidBelt';
import type { CollisionObserver } from './CollisionObserver';
import { Ship } from './Ship';
import { SupplyField } from './SupplyField';

export class Game {
  readonly ship = new Ship();
  readonly asteroidBelt = new AsteroidBelt(this.ship.position);
  readonly supplyField = new SupplyField(this.ship.position);
  elapsed = 0;

  get speed(): number { return this.ship.speed; }
  get thrusting(): boolean { return this.ship.isThrusting; }
  get thrustAmount(): number { return this.ship.thrustAmount; }

  setThrustTarget(target: Vec2): void { this.ship.aimAt(target); }
  startThrust(): void { this.ship.startThrust(); }
  stopThrust(): void { this.ship.stopThrust(); }
  addCollisionObserver(observer: CollisionObserver): void { this.asteroidBelt.addCollisionObserver(observer); }
  removeCollisionObserver(observer: CollisionObserver): void { this.asteroidBelt.removeCollisionObserver(observer); }

  update(dt: number): void {
    dt = Math.min(dt, 0.033);
    this.elapsed += dt;
    this.ship.updateLifeSupport(dt);
    this.ship.applyControls(dt);

    this.ship.integrate(dt);
    this.asteroidBelt.update(dt, this.ship);
    this.supplyField.update(dt, this.ship, this.asteroidBelt);
  }
}
