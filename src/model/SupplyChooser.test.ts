import { describe, expect, it } from 'vitest';
import { SupplyChooser, SupplyType } from './SupplyChooser';

describe('SupplyChooser', () => {
  it('REQ-51 chooses the resource with the strict-lowest meter when it is not visible', () => {
    const chosen = SupplyChooser.choose({ fuel: 0, hp: 100, ammo: 100 }, new Set(), () => 0);
    expect(chosen).toBe(SupplyType.Fuel);
  });

  it('REQ-51 chooses the next tier when the lowest-meter type is already visible', () => {
    const chosen = SupplyChooser.choose({ fuel: 0, hp: 50, ammo: 100 }, new Set([SupplyType.Fuel]), () => 0);
    expect(chosen).toBe(SupplyType.Hp);
  });

  it('REQ-51 breaks ties for the lowest meter randomly', () => {
    const toFuel = SupplyChooser.choose({ fuel: 0, hp: 0, ammo: 100 }, new Set(), () => 0.99);
    expect(toFuel).toBe(SupplyType.Fuel);
    const toHp = SupplyChooser.choose({ fuel: 0, hp: 0, ammo: 100 }, new Set(), () => 0);
    expect(toHp).toBe(SupplyType.Hp);
  });

  it('REQ-51 falls back to a random type when every type is already visible', () => {
    const visible = new Set([SupplyType.Fuel, SupplyType.Hp, SupplyType.Ammo]);
    expect(SupplyChooser.choose({ fuel: 0, hp: 50, ammo: 100 }, visible, () => 0)).toBe(SupplyType.Fuel);
    expect(SupplyChooser.choose({ fuel: 0, hp: 50, ammo: 100 }, visible, () => 0.5)).toBe(SupplyType.Hp);
    expect(SupplyChooser.choose({ fuel: 0, hp: 50, ammo: 100 }, visible, () => 0.9)).toBe(SupplyType.Ammo);
  });
});
