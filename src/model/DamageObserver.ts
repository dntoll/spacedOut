import type { Damage } from './Damage';

export interface DamageObserver {
  onDamage(damage: Damage): void;
}
