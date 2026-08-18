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

  it('REQ-23 does not mark a huge body discovered when only its bounding-box corner touches explored space', () => {
    const exploration = new ExplorationMap();
    exploration.observe({ left: -250, top: -250, right: 250, bottom: 250 });

    // A massive body centered diagonally far from spawn: its bounding box
    // [300, 2700] overlaps explored cell (1, 1) [250, 500], but its circular
    // body (closest point ~651, 651) never reaches any explored cell.
    expect(exploration.isCircleExplored({ x: 1500, y: 1500 }, 1200)).toBe(false);
    // The bounding-box check would wrongly discover it.
    expect(exploration.isExplored({ x: 1500, y: 1500 }, 1200)).toBe(true);

    // A body whose circle actually reaches explored space is discovered.
    expect(exploration.isCircleExplored({ x: 900, y: 900 }, 1200)).toBe(true);
  });
});
