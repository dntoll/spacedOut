import { AsteroidTier } from './AsteroidTier';
import type { Vec2 } from '../types';

export class AsteroidDestroyed {
  constructor(
    public readonly position: Vec2,
    public readonly tier: AsteroidTier,
  ) {}
}
