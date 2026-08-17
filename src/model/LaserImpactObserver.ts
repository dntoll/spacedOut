import type { Collision } from './Collision';

export interface LaserImpactObserver {
  onLaserImpact(collision: Collision): void;
}
