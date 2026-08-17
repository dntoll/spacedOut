import type { Vec2 } from '../types';
import { AirContainer } from './AirContainer';
import type { AsteroidBelt } from './AsteroidBelt';
import { FuelContainer } from './FuelContainer';
import { HpContainer } from './HpContainer';
import { RandomSequence } from './RandomSequence';
import type { Ship } from './Ship';
import type { SupplyContainer } from './SupplyContainer';

export class SupplyRegion {
  private readonly containers: SupplyContainer[] = [];

  constructor(
    public readonly column: number,
    public readonly row: number,
    regionSize: number,
    worldSeed: number,
    initialContainers?: SupplyContainer[],
  ) {
    if (initialContainers) {
      this.containers.push(...initialContainers);
      return;
    }

    const random = new RandomSequence(
      worldSeed
      ^ Math.imul(this.column, 0x9e3779b1)
      ^ Math.imul(this.row, 0x85ebca6b),
    );
    this.containers.push(
      new AirContainer(this.createPosition(regionSize, random)),
      new FuelContainer(this.createPosition(regionSize, random)),
      new HpContainer(this.createPosition(regionSize, random)),
    );
  }

  update(dt: number, ship: Ship, asteroidBelt: AsteroidBelt): void {
    for (let index = this.containers.length - 1; index >= 0; index--) {
      const container = this.containers[index];
      container.integrate(dt);
      asteroidBelt.collideWith(container);

      const dx = container.position.x - ship.position.x;
      const dy = container.position.y - ship.position.y;
      const collectionRadius = container.radius + ship.radius;
      if (dx * dx + dy * dy <= collectionRadius * collectionRadius) {
        container.collect(ship);
        this.containers.splice(index, 1);
      }
    }
  }

  forEach(visitor: (container: SupplyContainer) => void): void {
    this.containers.forEach(visitor);
  }

  private createPosition(regionSize: number, random: RandomSequence): Vec2 {
    const margin = 80;
    return {
      x: this.column * regionSize + random.between(margin, regionSize - margin),
      y: this.row * regionSize + random.between(margin, regionSize - margin),
    };
  }
}
