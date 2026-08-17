import type { AsteroidDestroyed } from './AsteroidDestroyed';

export interface AsteroidDestroyedObserver {
  onDestroyed(event: AsteroidDestroyed): void;
}
