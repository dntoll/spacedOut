import type { Vec2 } from '../types';
import type { Ship } from './Ship';
import { SupplyContainer } from './SupplyContainer';
import { SupplyType } from './SupplyChooser';

const SHIELD_POD_RADIUS = 19;

export class ShieldPod extends SupplyContainer {
  constructor(position: Vec2) { super(position, 0, SHIELD_POD_RADIUS); }
  get type(): SupplyType { return SupplyType.Shield; }
  collect(ship: Ship): void { ship.installShield(); }
}
