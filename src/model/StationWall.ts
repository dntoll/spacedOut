import type { Vec2 } from '../types';
import { add, scale } from '../math';
import { MassiveAsteroid } from './MassiveAsteroid';
import { rectangleVertices } from './StationGeometry';

let nextWallId = 0x8_0000_0000;

const allocateId = (): number => nextWallId++;

export class StationWall extends MassiveAsteroid {
  readonly halfLength: number;
  readonly halfWidth: number;
  readonly a: Vec2;
  readonly b: Vec2;
  readonly wallRadius: number;

  constructor(position: Vec2, angle: number, halfLength: number, halfWidth: number, samples = 24) {
    super(allocateId(), position, halfLength, angle, rectangleVertices(halfLength, halfWidth, samples), [], 0.5);
    this.halfLength = halfLength;
    this.halfWidth = halfWidth;
    const along = { x: Math.cos(angle) * halfLength, y: Math.sin(angle) * halfLength };
    this.a = add(position, scale(along, -1));
    this.b = add(position, along);
    this.wallRadius = halfWidth;
  }
}
