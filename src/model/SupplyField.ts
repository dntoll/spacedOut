import { add, length, random, sub } from '../math';
import type { Vec2 } from '../types';
import { AirContainer } from './AirContainer';
import type { AsteroidBelt } from './AsteroidBelt';
import { FuelContainer } from './FuelContainer';
import type { Ship } from './Ship';
import type { SupplyContainer } from './SupplyContainer';

export class SupplyField {
  private containers: SupplyContainer[] = [];

  constructor(center: Vec2, initialContainers?: SupplyContainer[]) {
    if (initialContainers) {
      this.containers.push(...initialContainers);
      return;
    }
    for (let i = 0; i < 20; i++) this.containers.push(this.createContainer(center, 250, 1500, i % 2 === 0));
  }

  update(dt: number, ship: Ship, asteroidBelt: AsteroidBelt): void {
    for (let i = 0; i < this.containers.length; i++) {
      const container = this.containers[i];
      container.integrate(dt);
      asteroidBelt.collideWith(container);
      if (length(sub(container.position, ship.position)) <= container.radius + ship.radius) {
        container.collect(ship);
        this.containers[i] = this.createContainer(ship.position, 900, 1450, container instanceof AirContainer);
      }
    }
  }

  forEach(visitor: (container: SupplyContainer) => void): void {
    this.containers.forEach(visitor);
  }

  private createContainer(center: Vec2, minDistance: number, maxDistance: number, air: boolean): SupplyContainer {
    const angle = random(0, Math.PI * 2);
    const distance = random(minDistance, maxDistance);
    const position = add(center, { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance });
    return air ? new AirContainer(position) : new FuelContainer(position);
  }
}
