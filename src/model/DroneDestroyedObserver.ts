import type { DroneDestroyed } from './DroneDestroyed';

export interface DroneDestroyedObserver {
  onDroneDestroyed(event: DroneDestroyed): void;
}
