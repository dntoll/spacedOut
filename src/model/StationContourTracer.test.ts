import { describe, expect, it } from 'vitest';
import { traceContours } from './StationContourTracer';

const grid = (carved: Array<[number, number]>, gridN: number) => {
  const set = new Set(carved.map(([c, r]) => `${c},${r}`));
  const inB = (c: number, r: number) => c >= 0 && r >= 0 && c < gridN && r < gridN;
  const isCarved = (c: number, r: number) => set.has(`${c},${r}`);
  const isRock = (c: number, r: number) => inB(c, r) && !isCarved(c, r);
  return { isCarved, isRock };
};

describe('StationContourTracer', () => {
  it('traces a single carved cell as a closed 4-vertex square (the floor corners)', () => {
    const { isCarved, isRock } = grid([[1, 1]], 3);
    const contours = traceContours(3, 1, 1.5, isCarved, isRock);
    expect(contours).toHaveLength(1);
    expect(contours[0].closed).toBe(true);
    expect(contours[0].points).toHaveLength(4);
  });

  it('traces a 2x2 carved block as one closed 4-vertex square (merged collinear runs)', () => {
    const { isCarved, isRock } = grid([[1, 1], [2, 1], [1, 2], [2, 2]], 4);
    const contours = traceContours(4, 1, 2, isCarved, isRock);
    expect(contours).toHaveLength(1);
    expect(contours[0].closed).toBe(true);
    expect(contours[0].points).toHaveLength(4);
  });

  it('traces an L-shaped room as one closed 6-vertex contour', () => {
    const { isCarved, isRock } = grid([[1, 1], [2, 1], [1, 2]], 4);
    const contours = traceContours(4, 1, 2, isCarved, isRock);
    expect(contours).toHaveLength(1);
    expect(contours[0].closed).toBe(true);
    expect(contours[0].points).toHaveLength(6);
  });

  it('traces two separate interior rooms as two closed contours', () => {
    const { isCarved, isRock } = grid([[1, 1], [3, 3]], 5);
    const contours = traceContours(5, 1, 2.5, isCarved, isRock);
    expect(contours).toHaveLength(2);
    expect(contours.every((c) => c.closed && c.points.length === 4)).toBe(true);
  });

  it('leaves the contour open where the carved cell reaches the rim (entrance opening)', () => {
    // Cell (0,0) at the grid corner: top and left face space (out of bounds),
    // right and bottom face rock -> an open L chain.
    const { isCarved, isRock } = grid([[0, 0]], 3);
    const contours = traceContours(3, 1, 1.5, isCarved, isRock);
    expect(contours).toHaveLength(1);
    expect(contours[0].closed).toBe(false);
    expect(contours[0].points).toHaveLength(3);
  });

  it('collapses a diagonal staircase into straight diagonal edges', () => {
    // A 2-wide diagonal corridor: cells form a staircase pattern, so the traced
    // boundary staircases. The simplification should collapse those into diagonal
    // edges, reducing the vertex count and producing non-axis-aligned edges.
    const { isCarved, isRock } = grid(
      [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3]],
      6,
    );
    const contours = traceContours(6, 1, 3, isCarved, isRock);
    expect(contours).toHaveLength(1);
    expect(contours[0].closed).toBe(true);
    const pts = contours[0].points;
    // Without simplification this would have ~12+ vertices; the diagonal
    // collapse should reduce it substantially.
    expect(pts.length).toBeLessThan(10);
    // At least one edge should be diagonal (both dx and dy nonzero).
    let hasDiagonal = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (Math.abs(b.x - a.x) > 0.01 && Math.abs(b.y - a.y) > 0.01) { hasDiagonal = true; break; }
    }
    expect(hasDiagonal).toBe(true);
  });
});
