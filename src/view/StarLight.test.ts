import { describe, expect, it } from 'vitest';
import { StarLight, type ShadowCasters } from './StarLight';

const LIGHT = { x: 0.6, y: 0.8 };

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function singleCaster(position: { x: number; y: number }, radius: number): ShadowCasters {
  return { forEachCaster: (fn) => fn({ position, radius }) };
}

describe('StarLight', () => {
  it('REQ-70 rotates the world light direction into each object local frame by -angle', () => {
    const star = new StarLight(LIGHT);
    const at0 = star.localDirection(0);
    expect(at0.x).toBeCloseTo(LIGHT.x, 5);
    expect(at0.y).toBeCloseTo(LIGHT.y, 5);
    const atQuarter = star.localDirection(Math.PI / 2);
    expect(atQuarter.x).toBeCloseTo(LIGHT.y, 5);
    expect(atQuarter.y).toBeCloseTo(-LIGHT.x, 5);
  });

  it('REQ-70 keeps the dark side of a body fill visible above pure black', () => {
    const star = new StarLight(LIGHT);
    const paint = star.bodyPaint({ x: 1, y: 0 }, 30, '#536175', '#0b101b', 0);
    const darkStop = paint.stops[paint.stops.length - 1].color;
    expect(darkStop).not.toBe('#000000');
    expect(luminance(darkStop)).toBeGreaterThanOrEqual(15);
  });

  it('REQ-70 renders a near-white high-contrast lit rim brighter than the lit face and the dark side', () => {
    const star = new StarLight(LIGHT);
    const paint = star.bodyPaint({ x: 1, y: 0 }, 30, '#536175', '#0b101b', 0);
    const rim = luminance(paint.stops[0].color);
    const lit = luminance(paint.stops[1].color);
    const dark = luminance(paint.stops[paint.stops.length - 1].color);
    expect(rim).toBeGreaterThan(230);
    expect(rim).toBeGreaterThan(lit);
    expect(lit).toBeGreaterThan(dark);
  });

  it('REQ-71 scales the shadow length by occluder radius via shadowLengthFor', () => {
    const star = new StarLight(LIGHT, 2400);
    expect(star.shadowLengthFor(20)).toBe(200);
    expect(star.shadowLengthFor(1000)).toBe(2400);
  });

  it('REQ-70 collapses the body fill to uniform dark when fully shadowed', () => {
    const star = new StarLight(LIGHT);
    const paint = star.bodyPaint({ x: 1, y: 0 }, 30, '#536175', '#0b101b', 1);
    expect(paint.stops[0].color).toBe(paint.stops[1].color);
    expect(paint.stops[0].color).toBe(paint.stops[paint.stops.length - 1].color);
  });

  it('REQ-70 places the lit gradient endpoint toward the sun and the dark endpoint away from it', () => {
    const star = new StarLight(LIGHT);
    const localDir = { x: 0, y: 1 };
    const paint = star.bodyPaint(localDir, 40, '#ffffff', '#000000', 0);
    expect(paint.from.y).toBeLessThan(0);
    expect(paint.to.y).toBeGreaterThan(0);
  });

  it('REQ-71 casts no shadow when there are no casters', () => {
    const star = new StarLight(LIGHT, 2400);
    expect(star.shadowFactor({ x: 0, y: 0 }, 20, null)).toBe(0);
  });

  it('REQ-71 reuses a prepared caster snapshot for repeated shadow checks', () => {
    const star = new StarLight(LIGHT, 2400);
    let fallbackScans = 0;
    const casters: ShadowCasters = {
      casters: [{ position: { x: 0, y: 0 }, radius: 500 }],
      forEachCaster: () => { fallbackScans++; },
    };
    const behind = { x: LIGHT.x * 100, y: LIGHT.y * 100 };

    expect(star.shadowFactor(behind, 20, casters)).toBeGreaterThan(0.9);
    expect(star.particleAlpha(behind, 0.6, casters)).toBeLessThan(0.6);
    expect(fallbackScans).toBe(0);
  });

  it('REQ-71 darkens a smaller object that is directly behind an occluder within range', () => {
    const star = new StarLight(LIGHT, 2400);
    const casters = singleCaster({ x: 0, y: 0 }, 500);
    const behind = { x: LIGHT.x * 100, y: LIGHT.y * 100 };
    expect(star.shadowFactor(behind, 20, casters)).toBeGreaterThan(0.9);
  });

  it('REQ-71 casts no shadow beyond the occluder shadow length', () => {
    const star = new StarLight(LIGHT, 2400);
    const casters = singleCaster({ x: 0, y: 0 }, 500);
    const behind = { x: LIGHT.x * 3000, y: LIGHT.y * 3000 };
    expect(star.shadowFactor(behind, 20, casters)).toBe(0);
  });

  it('REQ-71 half-shades an object near the cone edge', () => {
    const star = new StarLight(LIGHT, 2400);
    const casters = singleCaster({ x: 0, y: 0 }, 500);
    const perp = { x: -LIGHT.y, y: LIGHT.x };
    const edge = { x: LIGHT.x * 100 + perp.x * 500, y: LIGHT.y * 100 + perp.y * 500 };
    const factor = star.shadowFactor(edge, 20, casters);
    expect(factor).toBeGreaterThan(0.35);
    expect(factor).toBeLessThan(0.6);
  });

  it('REQ-71 scales shadow length by occluder radius so small asteroids cast short shadows', () => {
    const star = new StarLight(LIGHT, 2400);
    const small = singleCaster({ x: 0, y: 0 }, 20);
    const nearBehind = { x: LIGHT.x * 50, y: LIGHT.y * 50 };
    expect(star.shadowFactor(nearBehind, 5, small)).toBeGreaterThan(0.5);
    const farBehind = { x: LIGHT.x * 400, y: LIGHT.y * 400 };
    expect(star.shadowFactor(farBehind, 5, small)).toBe(0);
  });

  it('REQ-71 casts long shadows from massive asteroids', () => {
    const star = new StarLight(LIGHT, 2400);
    const massive = singleCaster({ x: 0, y: 0 }, 1000);
    const behind = { x: LIGHT.x * 1500, y: LIGHT.y * 1500 };
    expect(star.shadowFactor(behind, 20, massive)).toBeGreaterThan(0.3);
  });

  it('REQ-71 darkens atmospheric particles within a shadow', () => {
    const star = new StarLight(LIGHT, 2400);
    const casters = singleCaster({ x: 0, y: 0 }, 500);
    const behind = { x: LIGHT.x * 100, y: LIGHT.y * 100 };
    const lit = star.particleAlpha({ x: -1000, y: -1000 }, 0.6, casters);
    const shadowed = star.particleAlpha(behind, 0.6, casters);
    expect(shadowed).toBeLessThan(lit);
    expect(shadowed).toBeGreaterThan(0);
  });
});
