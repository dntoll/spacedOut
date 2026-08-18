import type { Vec2 } from '../types';
import type { Ship } from './Ship';
import { SupplyContainer } from './SupplyContainer';
import { SupplyType } from './SupplyChooser';

const WEAPON_POD_RADIUS = 19;

export class WeaponPod extends SupplyContainer {
  constructor(position: Vec2) { super(position, 0, WEAPON_POD_RADIUS); }
  get type(): SupplyType { return SupplyType.Weapon; }
  collect(ship: Ship): void { ship.upgradeWeapon(); }
}
