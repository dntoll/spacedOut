import type { CollectablePickup } from './CollectablePickup';

export interface CollectablePickupObserver {
  onCollectablePickup(event: CollectablePickup): void;
}
