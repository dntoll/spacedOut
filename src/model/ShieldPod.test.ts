import { describe, expect, it } from 'vitest';
import { AmmoContainer } from './AmmoContainer';
import { Ship } from './Ship';
import { ShieldPod } from './ShieldPod';

describe('ShieldPod', () => {
  it('REQ-91 is larger than a standard supply container and installs the shield when collected', () => {
    const pod = new ShieldPod({ x: 0, y: 0 });
    const standard = new AmmoContainer({ x: 0, y: 0 });
    expect(pod.radius).toBeGreaterThan(standard.radius);

    const ship = new Ship();
    expect(ship.hasShield).toBe(false);
    pod.collect(ship);
    expect(ship.hasShield).toBe(true);
  });
});
