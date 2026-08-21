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
});
