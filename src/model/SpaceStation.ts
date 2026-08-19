import type { Vec2 } from '../types';
import { MassiveAsteroid } from './MassiveAsteroid';

const HULL_SEGMENTS = 32;

export class SpaceStation extends MassiveAsteroid {
  constructor(position: Vec2, radius: number, angle: number) {
    super(0x7fffffff, position, radius, angle, SpaceStation.createHull(), [], 0.5);
  }

  private static createHull(): number[] {
    return Array.from({ length: HULL_SEGMENTS }, (_, index) => {
      const armOffset = index % (HULL_SEGMENTS / 4);
      if (armOffset === 0) return 1;
      if (armOffset === 1 || armOffset === HULL_SEGMENTS / 4 - 1) return 0.9;
      return index % 2 === 0 ? 0.7 : 0.64;
    });
  }
}
