import { describe, expect, it } from 'vitest';
import { DiscoveredMap } from './DiscoveredMap';

describe('DiscoveredMap', () => {
  it('records discovered cells from a bounds rectangle', () => {
    const map = new DiscoveredMap();

    map.record({ left: -250, top: -100, right: 300, bottom: 200 });

    expect(map.isCircleDiscovered({ x: 0, y: 0 }, 0)).toBe(true);
    expect(map.isCircleDiscovered({ x: 2000, y: 0 }, 0)).toBe(false);
  });

  it('accumulates discovered cells across multiple records', () => {
    const map = new DiscoveredMap();

    map.record({ left: -250, top: -100, right: 300, bottom: 200 });
    expect(map.isCircleDiscovered({ x: 2000, y: 0 }, 0)).toBe(false);

    map.record({ left: 1900, top: -100, right: 2200, bottom: 200 });
    expect(map.isCircleDiscovered({ x: 2000, y: 0 }, 0)).toBe(true);
    expect(map.isCircleDiscovered({ x: 0, y: 0 }, 0)).toBe(true);
  });

  it('reports a circle discovered only when a discovered cell falls within radius', () => {
    const map = new DiscoveredMap();

    map.record({ left: -250, top: -250, right: 250, bottom: 250 });

    // A circle centered diagonally far from spawn whose closest discovered
    // cell point (~651, 651) stays outside the 1200 radius.
    expect(map.isCircleDiscovered({ x: 1500, y: 1500 }, 1200)).toBe(false);
    // A circle that actually reaches explored space is discovered.
    expect(map.isCircleDiscovered({ x: 900, y: 900 }, 1200)).toBe(true);
  });

  it('clears all discovered cells on reset', () => {
    const map = new DiscoveredMap();

    map.record({ left: -250, top: -250, right: 250, bottom: 250 });
    expect(map.isCircleDiscovered({ x: 0, y: 0 }, 0)).toBe(true);

    map.reset();

    expect(map.isCircleDiscovered({ x: 0, y: 0 }, 0)).toBe(false);
  });
});
