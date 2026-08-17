import type { Vec2 } from '../types';

export class DroneDestroyed {
  constructor(public readonly position: Vec2) {}
}
