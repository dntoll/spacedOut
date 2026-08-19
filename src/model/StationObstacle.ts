import type { Vec2 } from '../types';
import { PhysicsBody } from './PhysicsBody';

let nextStationObstacleId = 0x8_0000_0000;

const allocateId = (): number => nextStationObstacleId++;

export abstract class StationObstacle extends PhysicsBody {
  readonly id: number;

  constructor(position: Vec2, radius: number, angle: number) {
    super(position, { x: 0, y: 0 }, radius, Number.POSITIVE_INFINITY, angle, 0, true);
    this.id = allocateId();
  }
}
