import { describe, expect, it } from 'vitest';
import { DamageCalculator } from './DamageCalculator';

describe('DamageCalculator', () => {
  it('REQ-33 deals no damage at or below the violent threshold', () => {
    expect(DamageCalculator.damageFor(0, true)).toBe(0);
    expect(DamageCalculator.damageFor(500, true)).toBe(0);
    expect(DamageCalculator.damageFor(500, false)).toBe(0);
  });

  it('REQ-33 deals damage when impact speed exceeds 500', () => {
    expect(DamageCalculator.damageFor(501, true)).toBeGreaterThan(0);
    expect(DamageCalculator.damageFor(501, false)).toBeGreaterThan(0);
  });

  it('REQ-33 inflicts more damage on massive asteroids than on regular ones', () => {
    const speed = 650;
    expect(DamageCalculator.damageFor(speed, true))
      .toBeGreaterThan(DamageCalculator.damageFor(speed, false));
  });

  it('REQ-33 caps a single hit so two full-speed impacts are barely survivable', () => {
    const fullSpeed = 650;
    const perHit = DamageCalculator.damageFor(fullSpeed, true);
    expect(perHit).toBeLessThanOrEqual(DamageCalculator.maxDamagePerHit);
    expect(100 - 2 * perHit).toBeGreaterThan(0);
    expect(100 - 3 * perHit).toBeLessThanOrEqual(0);
    expect(DamageCalculator.damageFor(5000, true)).toBe(DamageCalculator.maxDamagePerHit);
  });
});
