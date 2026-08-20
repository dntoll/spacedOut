import { describe, expect, it, vi } from 'vitest';
import { Station } from '../model/Station';
import type { Vec2 } from '../types';
import type { Drawing, Paint } from './Drawing';
import { StationInterior } from './StationInterior';
import { StarLight } from './StarLight';

const STATION_RADIUS = 1000;

const placeStation = (entranceAngle = 0, seed = 42): Station => {
  const station = new Station();
  station.placeAt({ x: 0, y: 0 }, STATION_RADIUS, entranceAngle, seed);
  return station;
};

const isOpaque = (fill: Paint): boolean => {
  if (typeof fill !== 'string') return false;
  if (fill.startsWith('#')) return true;
  if (fill.startsWith('rgb(')) return true;
  const match = /^rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)$/.exec(fill);
  return match !== null && Number.parseFloat(match[1]) >= 1;
};

const pointInPolygon = (p: Vec2, poly: Vec2[]): boolean => {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
};

describe('StationInterior', () => {
  it('REQ-85 fills the entire carved interior void with an opaque floor so stars do not show through', () => {
    const station = placeStation();
    const fills: Array<{ paths: Vec2[][]; fill: Paint }> = [];
    const drawing = {
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      polygon: vi.fn(),
      circle: vi.fn(),
      arc: vi.fn(),
      line: vi.fn(),
      fillPolygons: (paths: Vec2[][], fill: Paint) => fills.push({ paths, fill }),
    } as unknown as Drawing;

    new StationInterior().draw(drawing, station, new StarLight(), 1);

    const floor = fills.find((f) => isOpaque(f.fill));
    expect(floor).toBeDefined();

    const carver = station.carver!;
    const center = station.center!;
    const rotation = station.entranceAngle;
    let uncovered = 0;
    let corridorChecked = false;
    for (let r = 0; r < carver.gridN; r++) {
      for (let c = 0; c < carver.gridN; c++) {
        if (carver.bitmap[r * carver.gridN + c] !== 1) continue;
        const world = carver.localToWorld(carver.cellCenterLocal(c, r), center, rotation);
        if (!floor!.paths.some((quad) => pointInPolygon(world, quad))) uncovered++;
        // Confirm a corridor cell (adjacent to two carved neighbours along an axis)
        // is covered, not just the named rooms.
        const left = c > 0 && carver.bitmap[r * carver.gridN + (c - 1)] === 1;
        const right = c < carver.gridN - 1 && carver.bitmap[r * carver.gridN + (c + 1)] === 1;
        const above = r > 0 && carver.bitmap[(r - 1) * carver.gridN + c] === 1;
        const below = r < carver.gridN - 1 && carver.bitmap[(r + 1) * carver.gridN + c] === 1;
        if ((left && right) || (above && below)) corridorChecked = true;
      }
    }
    expect(uncovered).toBe(0);
    expect(corridorChecked).toBe(true);
  });

  it('REQ-85 keeps the floor opaque regardless of station orientation', () => {
    const station = placeStation(Math.PI / 3, 7);
    const fills: Array<{ paths: Vec2[][]; fill: Paint }> = [];
    const drawing = {
      withTransform: (_position: unknown, _angle: number, draw: () => void) => draw(),
      polygon: vi.fn(),
      circle: vi.fn(),
      arc: vi.fn(),
      line: vi.fn(),
      fillPolygons: (paths: Vec2[][], fill: Paint) => fills.push({ paths, fill }),
    } as unknown as Drawing;

    new StationInterior().draw(drawing, station, new StarLight(), 1);

    const floor = fills.find((f) => isOpaque(f.fill));
    expect(floor).toBeDefined();
    expect(floor!.paths.length).toBeGreaterThan(0);
  });
});
