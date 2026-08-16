import { describe, expect, it, vi } from 'vitest';
import { ExplorationMap } from './ExplorationMap';

describe('ExplorationMap', () => {
  it('REQ-23 records camera-visible space and keeps it explored after travel', () => {
    const exploration = new ExplorationMap();
    exploration.observe({ left: -200, top: -100, right: 300, bottom: 200 });

    expect(exploration.isExplored({ x: 0, y: 0 })).toBe(true);
    expect(exploration.isExplored({ x: 2000, y: 0 })).toBe(false);

    exploration.observe({ left: 1900, top: -100, right: 2200, bottom: 200 });
    expect(exploration.isExplored({ x: 0, y: 0 })).toBe(true);
    expect(exploration.isExplored({ x: 2000, y: 0 })).toBe(true);

    const visitor = vi.fn();
    exploration.forEachVisibleCell({ x: 2000, y: 0 }, 1000, visitor);
    expect(visitor).toHaveBeenCalled();
  });
});
