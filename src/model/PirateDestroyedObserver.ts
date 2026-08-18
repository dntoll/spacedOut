import type { PirateDestroyed } from './PirateDestroyed';

export interface PirateDestroyedObserver {
  onPirateDestroyed(event: PirateDestroyed): void;
}
