import type { LaserShot } from './LaserShot';

export interface LaserShotObserver {
  onLaserShot(event: LaserShot): void;
}
