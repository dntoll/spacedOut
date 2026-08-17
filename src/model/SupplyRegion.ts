import type { Vec2 } from '../types';
import { AmmoContainer } from './AmmoContainer';
import type { AsteroidBelt } from './AsteroidBelt';
import { FuelContainer } from './FuelContainer';
import { HpContainer } from './HpContainer';
import { RandomSequence } from './RandomSequence';
import type { Ship } from './Ship';
import { SupplyType } from './SupplyChooser';
import type { SupplyContainer } from './SupplyContainer';

export class SupplyRegion {
  private readonly containers: SupplyContainer[] = [];

  static seedFor(column: number, row: number, worldSeed: number): number {
    return worldSeed
      ^ Math.imul(column, 0x9e3779b1)
      ^ Math.imul(row, 0x85ebca6b);
  }

  constructor(
    public readonly column: number,
    public readonly row: number,
    regionSize: number,
    worldSeed: number,
    initialContainers?: SupplyContainer[],
    chosenType?: SupplyType,
    private readonly onPickup: (position: Vec2) => void = () => {},
  ) {
    if (initialContainers) {
      this.containers.push(...initialContainers);
      return;
    }

    const random = new RandomSequence(SupplyRegion.seedFor(this.column, this.row, worldSeed));
    const type = chosenType ?? this.randomType(random);
    this.containers.push(this.createContainer(type, this.createPosition(regionSize, random)));
  }

  private createContainer(type: SupplyType, position: Vec2): SupplyContainer {
    if (type === SupplyType.Fuel) return new FuelContainer(position);
    if (type === SupplyType.Hp) return new HpContainer(position);
    return new AmmoContainer(position);
  }

  private randomType(random: RandomSequence): SupplyType {
    const index = random.integer(0, 3);
    if (index === 0) return SupplyType.Fuel;
    if (index === 1) return SupplyType.Hp;
    return SupplyType.Ammo;
  }

  update(dt: number, ship: Ship, asteroidBelt: AsteroidBelt): void {
    for (let index = this.containers.length - 1; index >= 0; index--) {
      const container = this.containers[index];
      container.attractToward(ship);
      container.integrate(dt);
      asteroidBelt.collideWith(container);

      const dx = container.position.x - ship.position.x;
      const dy = container.position.y - ship.position.y;
      const collectionRadius = container.radius + ship.radius;
      if (dx * dx + dy * dy <= collectionRadius * collectionRadius) {
        container.collect(ship);
        this.onPickup(container.position);
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
