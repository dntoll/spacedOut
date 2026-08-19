import type { Collision } from './Collision';

export interface PirateCollisionObserver {
  onPirateCollision(collision: Collision): void;
}
