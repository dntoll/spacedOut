import { describe, expect, it } from 'vitest';
import { SeenMap } from './SeenMap';
import type { Segment } from './LineOfSight';

describe('SeenMap', () => {
  it('REQ-23 marks cells within camera range when nothing blocks line of sight', () => {
    const seen = new SeenMap();
    seen.update({ x: 0, y: 0 }, 500, [], '');
    expect(seen.isSeen({ x: 400, y: 0 })).toBe(true);
    expect(seen.isSeen({ x: 800, y: 0 })).toBe(false);
  });

  it('REQ-23 does not mark cells beyond an occluder segment (line of sight blocked)', () => {
    const seen = new SeenMap();
    // A tall vertical wall at x=200 blocks rays going +x.
    const wall: Segment = { ax: 200, ay: -500, bx: 200, by: 500 };
    seen.update({ x: 0, y: 0 }, 1000, [wall], '');
    expect(seen.isSeen({ x: 100, y: 0 })).toBe(true);
    expect(seen.isSeen({ x: 600, y: 0 })).toBe(false);
  });

  it('REQ-23 keeps previously seen cells as the ship moves on', () => {
    const seen = new SeenMap();
    seen.update({ x: 0, y: 0 }, 500, [], '');
    expect(seen.isSeen({ x: 400, y: 0 })).toBe(true);
    // Move far away so the origin cell changes; the old cell must remain seen.
    seen.update({ x: 2000, y: 2000 }, 500, [], '');
    expect(seen.isSeen({ x: 400, y: 0 })).toBe(true);
  });

  it('REQ-23 re-reveals beyond a gate when its signature changes (gate opens)', () => {
    const seen = new SeenMap();
    // Closed gate: a segment at x=200 blocking +x rays.
    const closed: Segment = { ax: 200, ay: -500, bx: 200, by: 500 };
    seen.update({ x: 0, y: 0 }, 1000, [closed], 'closed');
    expect(seen.isSeen({ x: 600, y: 0 })).toBe(false);
    // Gate opens: occluder removed, signature changes, so a recast happens.
    seen.update({ x: 0, y: 0 }, 1000, [], 'open');
    expect(seen.isSeen({ x: 600, y: 0 })).toBe(true);
  });

  it('REQ-23 isCircleSeen matches a seen cell overlapping the circle, not just the bounding box', () => {
    const seen = new SeenMap();
    seen.update({ x: 0, y: 0 }, 400, [], '');
    // A point whose bounding box touches the seen region but whose circle body
    // does not reach a seen cell must not count as seen.
    expect(seen.isCircleSeen({ x: 700, y: 700 }, 100)).toBe(false);
    expect(seen.isCircleSeen({ x: 200, y: 0 }, 100)).toBe(true);
  });

  it('reset clears all seen cells', () => {
    const seen = new SeenMap();
    seen.update({ x: 0, y: 0 }, 500, [], '');
    expect(seen.isSeen({ x: 400, y: 0 })).toBe(true);
    seen.reset();
    expect(seen.isSeen({ x: 400, y: 0 })).toBe(false);
  });

  it('forEachSeenCellInBox visits only seen cells within the span', () => {
    const seen = new SeenMap();
    seen.update({ x: 0, y: 0 }, 500, [], '');
    const cells: { x: number; y: number }[] = [];
    seen.forEachSeenCellInBox({ x: 0, y: 0 }, 1000, (cell) => cells.push(cell));
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(seen.isSeen(cell)).toBe(true);
    }
  });
});
