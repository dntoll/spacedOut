import type { Collision } from './Collision';

export interface AsteroidCollisionObserver {
  onAsteroidCollision(collision: Collision): void;
}
