import type * as Model from '../model';
import type { Vec2 } from '../types';

// Shared line-of-sight geometry used by both the station lamp (REQ-87) and the
// minimap discovery map (REQ-23/81). Rays are cast from the ship origin and
// stopped at the nearest occluder segment, so anything beyond a wall, closed
// gate, or massive asteroid is not "seen" even when within camera range.

export interface Segment { ax: number; ay: number; bx: number; by: number }

// Structural shape shared by station wall chains, gates, machinery, and massive
// asteroids: a positioned, oriented body with either an explicit local polyline
// (wall chain) or a radial vertex list (polygon).
export interface Occluder {
  position: Vec2;
  angle: number;
  radius: number;
  localVertices?: Vec2[];
  closed?: boolean;
  vertices?: number[];
}

export const obstacleOutline = (o: Occluder): Vec2[] => {
  if (o.localVertices) {
    const cos = Math.cos(o.angle);
    const sin = Math.sin(o.angle);
    return o.localVertices.map((v) => ({
      x: o.position.x + v.x * cos - v.y * sin,
      y: o.position.y + v.x * sin + v.y * cos,
    }));
  }
  const vs = o.vertices!;
  const out: Vec2[] = [];
  for (let i = 0; i < vs.length; i++) {
    const a = (i / vs.length) * Math.PI * 2;
    out.push({
      x: o.position.x + Math.cos(a) * o.radius * vs[i],
      y: o.position.y + Math.sin(a) * o.radius * vs[i],
    });
  }
  return out;
};

export const obstacleSegments = (o: Occluder): Segment[] => {
  const outline = obstacleOutline(o);
  const closed = o.localVertices ? (o.closed ?? false) : true;
  const n = outline.length;
  const edgeCount = closed ? n : n - 1;
  const segs: Segment[] = [];
  for (let i = 0; i < edgeCount; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
  }
  return segs;
};

// Parametric ray-vs-segment intersection. Returns the ray parameter t (>=0) of
// the hit, or null if the ray misses the segment. `u` is the segment parameter.
export const raySegmentT = (ox: number, oy: number, dx: number, dy: number, s: Segment): number | null => {
  const sx = s.bx - s.ax;
  const sy = s.by - s.ay;
  const denom = dx * sy - dy * sx;
  if (denom > -1e-9 && denom < 1e-9) return null;
  const rx = s.ax - ox;
  const ry = s.ay - oy;
  const t = (rx * sy - ry * sx) / denom;
  const u = (rx * dy - ry * dx) / denom;
  if (u < 0 || u > 1 || t < 0) return null;
  return t;
};

// Occluder segments for minimap discovery (REQ-23/81): station hull + interior
// walls and closed gates block sight, and massive asteroids block sight.
// Machinery (decorative pillars) is excluded so it does not punch occlusion
// holes in room discovery, matching the roof reveal semantics (REQ-86).
export const gatherOccluderSegments = (
  station: Model.Station | null | undefined,
  massiveField: Model.MassiveAsteroidField,
  origin: Vec2,
  radius: number,
): Segment[] => {
  const segs: Segment[] = [];
  const within = (o: { position: Vec2; radius: number }): boolean => {
    const dx = o.position.x - origin.x;
    const dy = o.position.y - origin.y;
    const reach = radius + o.radius;
    return dx * dx + dy * dy <= reach * reach;
  };
  if (station?.isPlaced) {
    station.forEachWall((wall) => {
      if (within(wall)) for (const s of obstacleSegments(wall)) segs.push(s);
    });
    station.forEachGate((gate) => {
      if (gate.open || !within(gate)) return;
      for (const s of obstacleSegments(gate)) segs.push(s);
    });
  }
  massiveField.forEachKnown((asteroid) => {
    if (!within(asteroid)) return;
    for (const s of obstacleSegments(asteroid)) segs.push(s);
  });
  return segs;
};
