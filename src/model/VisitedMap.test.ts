import { describe, expect, it } from 'vitest';
import { VisitedMap } from './VisitedMap';

describe('VisitedMap', () => {
  it('records and reports visited cells by cell grid', () => {
    const map = new VisitedMap();
    expect(map.has({ x: 0, y: 0 })).toBe(false);
    map.visit({ x: 0, y: 0 });
    expect(map.has({ x: 0, y: 0 })).toBe(true);
    expect(map.has({ x: 500, y: 500 })).toBe(true);
    expect(map.has({ x: 1000, y: 0 })).toBe(false);
  });

  it('snapshots the charted cells independently of later visits', () => {
    const map = new VisitedMap();
    map.visit({ x: 0, y: 0 });
    const snapshot = map.snapshot();
    map.visit({ x: 2000, y: 0 });

    expect(map.contains(snapshot, { x: 0, y: 0 })).toBe(true);
    expect(map.contains(snapshot, { x: 2000, y: 0 })).toBe(false);
  });
});
