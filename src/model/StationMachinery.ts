import type { Vec2 } from '../types';
import { MassiveAsteroid } from './MassiveAsteroid';
import { rectangleVertices } from './StationGeometry';

let nextMachineryId = 0x8_4000_0000;

export class StationMachinery extends MassiveAsteroid {
  readonly variant: number;

  constructor(position: Vec2, radius: number, angle: number, variant: number) {
    super(
      nextMachineryId++,
      position,
      radius,
      angle,
      rectangleVertices(radius, radius * 0.72, 18),
      [],
      0.5,
    );
    this.variant = variant;
  }
}
