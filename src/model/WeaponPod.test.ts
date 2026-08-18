import { describe, expect, it } from 'vitest';
import { AmmoContainer } from './AmmoContainer';
import { Ship } from './Ship';
import { WeaponPod } from './WeaponPod';

describe('WeaponPod', () => {
  it('REQ-69 is larger than a standard supply container and upgrades the weapon when collected', () => {
    const pod = new WeaponPod({ x: 0, y: 0 });
    const standard = new AmmoContainer({ x: 0, y: 0 });
    expect(pod.radius).toBeGreaterThan(standard.radius);

    const ship = new Ship();
    expect(ship.weaponLevel).toBe(0);
    pod.collect(ship);
    expect(ship.weaponLevel).toBe(1);
  });
});
