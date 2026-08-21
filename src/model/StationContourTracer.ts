import type { Vec2 } from '../types';

// A wall contour traced from the carved bitmap: a polyline of merged corners
// (collinear runs collapsed) that follows the boundary between carved void and
// solid rock. `closed` is true for a room fully surrounded by rock; false where
// the carved void reaches the station rim (the entrance opening).
export interface Contour {
  points: Vec2[];
  closed: boolean;
}

interface DEdge {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ang: number;
  used: boolean;
}

// Trace every boundary edge where a carved cell faces solid rock into closed
// loops (rooms) and open chains (the entrance opening). Vertices are emitted in
// local space: ((col - half) * cellSize, (row - half) * cellSize). Consecutive
// collinear vertices are merged so a long room wall is a single edge.
//
// `isCarved` marks flyable interior cells; `isRock` marks a solid rock neighbor
// (carveable but not carved) — edges facing space (non-carveable) are not traced,
// which is what opens the entrance room to the hull gap.
export function traceContours(
  gridN: number,
  cellSize: number,
  half: number,
  isCarved: (c: number, r: number) => boolean,
  isRock: (c: number, r: number) => boolean,
): Contour[] {
  const edges: DEdge[] = [];
  const push = (ax: number, ay: number, bx: number, by: number): void => {
    edges.push({ ax, ay, bx, by, ang: Math.atan2(by - ay, bx - ax), used: false });
  };
  // Walk each carved cell's solid-rock sides clockwise (carved interior on the
  // right), so outer room boundaries are traced consistently.
  for (let r = 0; r < gridN; r++) {
    for (let c = 0; c < gridN; c++) {
      if (!isCarved(c, r)) continue;
      if (isRock(c, r - 1)) push(c, r, c + 1, r); // top: TL -> TR
      if (isRock(c + 1, r)) push(c + 1, r, c + 1, r + 1); // right: TR -> BR
      if (isRock(c, r + 1)) push(c + 1, r + 1, c, r + 1); // bottom: BR -> BL
      if (isRock(c - 1, r)) push(c, r + 1, c, r); // left: BL -> TL
    }
  }

  const outMap = new Map<string, DEdge[]>();
  const key = (x: number, y: number): string => `${x},${y}`;
  for (const e of edges) {
    const k = key(e.ax, e.ay);
    const arr = outMap.get(k) ?? [];
    arr.push(e);
    outMap.set(k, arr);
  }

  const toLocal = (x: number, y: number): Vec2 => ({ x: (x - half) * cellSize, y: (y - half) * cellSize });
  const contours: Contour[] = [];
  for (const start of edges) {
    if (start.used) continue;
    start.used = true;
    const pts: Vec2[] = [toLocal(start.ax, start.ay)];
    let cur = start;
    let closed = false;
    while (true) {
      const headKey = key(cur.bx, cur.by);
      const all = outMap.get(headKey) ?? [];
      // Allow the start edge to close the loop even though it is already used.
      const cands = all.filter((e) => !e.used || e === start);
      if (cands.length === 0) {
        pts.push(toLocal(cur.bx, cur.by));
        closed = false;
        break;
      }
      let next = cands[0];
      let bestTurn = turnClockwise(cur.ang, next.ang);
      for (let i = 1; i < cands.length; i++) {
        const t = turnClockwise(cur.ang, cands[i].ang);
        if (t < bestTurn) {
          bestTurn = t;
          next = cands[i];
        }
      }
      if (next === start) {
        closed = true;
        break;
      }
      next.used = true;
      pts.push(toLocal(next.ax, next.ay));
      cur = next;
    }
    contours.push({ points: mergeCollinear(pts, closed), closed });
  }
  return contours;
}

const turnClockwise = (from: number, to: number): number => {
  let t = (to - from) % (Math.PI * 2);
  if (t < 0) t += Math.PI * 2;
  return t;
};

const mergeCollinear = (pts: Vec2[], closed: boolean): Vec2[] => {
  const n = pts.length;
  if (n < 3) return pts;
  const out: Vec2[] = [];
  const isRedundant = (i: number): boolean => {
    const prev = closed ? pts[(i - 1 + n) % n] : pts[i - 1];
    const cur = pts[i];
    const next = closed ? pts[(i + 1) % n] : pts[i + 1];
    const cross = (next.x - prev.x) * (cur.y - prev.y) - (next.y - prev.y) * (cur.x - prev.x);
    if (Math.abs(cross) > 1e-9) return false;
    const dpx = next.x - prev.x;
    const dpy = next.y - prev.y;
    const dot = (cur.x - prev.x) * dpx + (cur.y - prev.y) * dpy;
    const len2 = dpx * dpx + dpy * dpy;
    return dot > 1e-9 && dot < len2 - 1e-9;
  };
  for (let i = 0; i < n; i++) {
    if (closed ? isRedundant(i) : i > 0 && i < n - 1 && isRedundant(i)) continue;
    out.push(pts[i]);
  }
  return out;
};
