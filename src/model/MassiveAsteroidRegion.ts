import { AsteroidCavityField } from './AsteroidCavityField';
import { MassiveAsteroid } from './MassiveAsteroid';
import { RandomSequence } from './RandomSequence';

export class MassiveAsteroidRegion {
  readonly asteroid: MassiveAsteroid;

  constructor(
    public readonly column: number,
    public readonly row: number,
    regionSize: number,
    shipRadius: number,
    worldSeed: number,
  ) {
    const random = new RandomSequence(
      worldSeed
      ^ Math.imul(column, 0x27d4eb2d)
      ^ Math.imul(row, 0x165667b1),
    );
    const radius = shipRadius * random.between(30, 100);
    const margin = radius + 300;
    const vertexCount = random.integer(24, 40);
    const vertices = Array.from({ length: vertexCount }, () => random.between(0.72, 1.16));
    const cavityCount = random.integer(9, 15);

    for (let index = 0; index < cavityCount; index++) {
      const vertex = random.integer(0, vertexCount);
      vertices[vertex] = random.between(0.24, 0.5);
      vertices[(vertex + 1) % vertexCount] = random.between(0.42, 0.7);
      vertices[(vertex + vertexCount - 1) % vertexCount] = random.between(0.42, 0.7);
    }

    this.asteroid = new MassiveAsteroid(
      (Math.imul(column, 73856093) ^ Math.imul(row, 19349663)) >>> 0,
      {
        x: column * regionSize + random.between(margin, regionSize - margin),
        y: row * regionSize + random.between(margin, regionSize - margin),
      },
      radius,
      random.between(0, Math.PI * 2),
      vertices,
      new AsteroidCavityField().create(radius, vertices, cavityCount, () => random.next()),
      random.next(),
    );
  }
}
