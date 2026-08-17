import type { Vec2 } from '../types';
import type { Ship } from './Ship';
import { SupplyContainer } from './SupplyContainer';
import { SupplyType } from './SupplyChooser';

export class AmmoContainer extends SupplyContainer {
  constructor(position: Vec2, amount = 24) { super(position, amount); }
  get type(): SupplyType { return SupplyType.Ammo; }
  collect(ship: Ship): void { ship.collectAmmo(this.amount); }
}
