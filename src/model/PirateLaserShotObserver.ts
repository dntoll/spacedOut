import type { LaserShot } from './LaserShot';

export interface PirateLaserShotObserver {
  onPirateLaserShot(event: LaserShot): void;
}
