import type { Collision } from './Collision';

export interface CollisionObserver {
  onCollision(collision: Collision): void;
}
