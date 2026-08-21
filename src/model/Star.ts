import { length, sub } from '../math';
import type { Vec2 } from '../types';
import { Damage } from './Damage';
import type { DamageObserver } from './DamageObserver';
import type { Ship } from './Ship';

export const STAR_RADIUS = 900;
const LETHAL_RANGE_FACTOR = 2.5;
const EDGE_HEAT = 12;
const CORE_HEAT = 52;
const SURFACE_HEAT = 100;

export class Star {
  private placed = false;
  private origin: Vec2 = { x: 0, y: 0 };
  private size = STAR_RADIUS;
  private readonly damageObservers = new Set<DamageObserver>();

  get isPlaced(): boolean { return this.placed; }
  get position(): Vec2 { return { ...this.origin }; }
  get radius(): number { return this.size; }
  get lethalRadius(): number { return this.size * LETHAL_RANGE_FACTOR; }

  placeAt(position: Vec2, radius = STAR_RADIUS): void {
    this.origin = { ...position };
    this.size = radius;
    this.placed = true;
  }

  clear(): void {
    this.placed = false;
  }

  addDamageObserver(observer: DamageObserver): void { this.damageObservers.add(observer); }
  removeDamageObserver(observer: DamageObserver): void { this.damageObservers.delete(observer); }

  heatFor(ship: Ship): number {
    if (!this.placed) return 0;
    const distance = length(sub(ship.position, this.origin));
    if (distance >= this.lethalRadius) return 0;
    if (distance <= this.size) return SURFACE_HEAT;
    const span = this.lethalRadius - this.size;
    const proximity = span > 0 ? 1 - (distance - this.size) / span : 1;
    return EDGE_HEAT + proximity * (CORE_HEAT - EDGE_HEAT);
  }

  applyHeat(ship: Ship): void {
    if (!this.placed || ship.isInvulnerable) return;
    const amount = this.heatFor(ship);
    if (amount <= 0) return;
    ship.takeDamage(amount);
    const event = new Damage({ ...ship.position }, amount, !ship.isAlive);
    for (const observer of this.damageObservers) observer.onDamage(event);
  }
}
