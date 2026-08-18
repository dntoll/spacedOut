import { describe, expect, it } from 'vitest';
import { dot } from '../math';
import type { Drawing } from './Drawing';
import { Camera } from './Camera';
import { ShadowVolume } from './ShadowVolume';
import { StarLight, type OutlinedShadowCasters } from './StarLight';

const LIGHT = { x: 0.6, y: 0.8 };
const PERP = { x: -LIGHT.y, y: LIGHT.x };

interface PolyCall { points: { x: number; y: number }[]; fill: { stops: { offset: number; color: string }[]; from: { x: number; y: number }; to: { x: number; y: number } } }

function stubDrawing(polygons: PolyCall[], fillPolygonsCalls: PolyCall[][] = []): Drawing {
  return {
    size: { width: 1000, height: 700 },
    withCamera: (_pos: unknown, _zoom: number, draw: () => void) => draw(),
    beginShadowLayer: () => {},
    endShadowLayer: () => {},
    polygon: (points: { x: number; y: number }[], fill: PolyCall['fill']) => polygons.push({ points, fill }),
    fillPolygons: (paths: { x: number; y: number }[][], fill: PolyCall['fill']) => fillPolygonsCalls.push(paths.map((p) => ({ points: p, fill }))),
  } as unknown as Drawing;
}

const perpSpread = (polys: PolyCall[]): number => {
  const dists = polys.flatMap((p) => p.points.map((pt) => dot(pt, PERP)));
  return Math.max(...dists) - Math.min(...dists);
};

describe('ShadowVolume', () => {
  it('REQ-71 draws a wider penumbra than umbra cone behind the caster in the light direction', () => {
    const polygons: PolyCall[] = [];
    const casters: OutlinedShadowCasters = {
      forEachCaster: () => {},
      forEachOutlinedCaster: (fn) => fn({ position: { x: 0, y: 0 }, radius: 100 }),
    };
    const star = new StarLight(LIGHT, 2400);

    new ShadowVolume().render(stubDrawing(polygons), casters, star, new Camera());

    expect(polygons).toHaveLength(2);
    const penumbra = polygons[0];
    const umbra = polygons[1];
    expect(perpSpread([penumbra])).toBeGreaterThan(perpSpread([umbra]));
    expect(umbra.fill.stops[0].color).toMatch(/rgba\(0,0,0,/);
    expect(umbra.fill.stops[umbra.fill.stops.length - 1].color).toBe('rgba(0,0,0,0)');
  });

  it('REQ-71 culls casters whose shadow cone is outside the visible range', () => {
    const polygons: PolyCall[] = [];
    const casters: OutlinedShadowCasters = {
      forEachCaster: () => {},
      forEachOutlinedCaster: (fn) => fn({ position: { x: 100000, y: 100000 }, radius: 100 }),
    };
    const star = new StarLight(LIGHT, 2400);

    new ShadowVolume().render(stubDrawing(polygons), casters, star, new Camera());

    expect(polygons).toHaveLength(0);
  });

  it('REQ-71 lets an off-screen caster project its shadow into the viewport', () => {
    const fillCalls: PolyCall[][] = [];
    const outline = [
      { x: -1100, y: -100 }, { x: -900, y: -100 },
      { x: -900, y: 100 }, { x: -1100, y: 100 },
    ];
    const casters: OutlinedShadowCasters = {
      forEachCaster: () => {},
      forEachOutlinedCaster: (fn) => fn({ position: { x: -1000, y: 0 }, radius: 100, outline }),
    };

    new ShadowVolume().render(stubDrawing([], fillCalls), casters, new StarLight({ x: 1, y: 0 }, 2400), new Camera());

    expect(fillCalls.length).toBeGreaterThan(0);
  });

  it('REQ-71 softens the distant tail of long shadows before their final endpoint', () => {
    const polygons: PolyCall[] = [];
    const casters: OutlinedShadowCasters = {
      forEachCaster: () => {},
      forEachOutlinedCaster: (fn) => fn({ position: { x: 0, y: 0 }, radius: 100 }),
    };

    new ShadowVolume().render(stubDrawing(polygons), casters, new StarLight(LIGHT, 2400), new Camera());

    expect(polygons[0].fill.stops).toHaveLength(4);
    expect(polygons[0].fill.stops[2].offset).toBe(0.75);
    expect(polygons[0].fill.stops[2].color).toMatch(/rgba\(0,0,0,0\.0/);
  });

  it('REQ-71 keeps a huge outlined caster penumbra attached instead of translating it down-light', () => {
    const fillCalls: PolyCall[][] = [];
    const outline = [
      { x: -1000, y: -1000 }, { x: 1000, y: -1000 },
      { x: 1000, y: 1000 }, { x: -1000, y: 1000 },
    ];
    const casters: OutlinedShadowCasters = {
      forEachCaster: () => {},
      forEachOutlinedCaster: (fn) => fn({ position: { x: 0, y: 0 }, radius: 1000, outline }),
    };
    const star = new StarLight({ x: 1, y: 0 }, 2400);

    new ShadowVolume().render(stubDrawing([], fillCalls), casters, star, new Camera());

    const penumbraXs = fillCalls[1].flatMap((path) => path.points.map((point) => point.x));
    expect(Math.min(...penumbraXs)).toBe(1000);
    expect(Math.max(...penumbraXs)).toBe(1000 + star.shadowLengthFor(1000));
  });

  it('REQ-71 caps huge circular-caster penumbra softness in screen space', () => {
    const polygons: PolyCall[] = [];
    const casters: OutlinedShadowCasters = {
      forEachCaster: () => {},
      forEachOutlinedCaster: (fn) => fn({ position: { x: 0, y: 0 }, radius: 1000 }),
    };

    new ShadowVolume().render(stubDrawing(polygons), casters, new StarLight(LIGHT, 2400), new Camera());

    expect(perpSpread([polygons[0]]) - perpSpread([polygons[1]])).toBeLessThanOrEqual(24);
  });

  it('REQ-71 extrudes shadow quads from the polygon back-facing edges so the volume matches the irregular outline', () => {
    const fillCalls: PolyCall[][] = [];
    const star = new StarLight({ x: 1, y: 0 }, 2400);
    const outline = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const casters: OutlinedShadowCasters = {
      forEachCaster: () => {},
      forEachOutlinedCaster: (fn) => fn({ position: { x: 0, y: 0 }, radius: 10, outline }),
    };

    new ShadowVolume().render(stubDrawing([], fillCalls), casters, star, new Camera());

    expect(fillCalls).toHaveLength(1);
    const umbra = fillCalls[0];
    const xs = umbra.flatMap((p) => p.points.map((pt) => pt.x));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(10);
    const len = star.shadowLengthFor(10);
    expect(Math.max(...xs)).toBeCloseTo(10 + len, 0);
  });
});
