import type { Vec2 } from '../types';

export interface VisibilitySegment {
  a: Vec2;
  b: Vec2;
}

interface RayHit {
  angle: number;
  point: Vec2;
}

const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

const raySegmentIntersection = (origin: Vec2, dir: Vec2, a: Vec2, b: Vec2): { t: number; point: Vec2 } | null => {
  const edgeDx = b.x - a.x;
  const edgeDy = b.y - a.y;
  const denom = cross(dir.x, dir.y, edgeDx, edgeDy);
  if (Math.abs(denom) < 1e-9) return null;
  const oax = a.x - origin.x;
  const oay = a.y - origin.y;
  const t = cross(oax, oay, edgeDx, edgeDy) / denom;
  const u = cross(oax, oay, dir.x, dir.y) / denom;
  if (t < 0 || u < 0 || u > 1) return null;
  return { t, point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t } };
};

const angleInCone = (angle: number, center: number, half: number): boolean => {
  let delta = angle - center;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta) <= half;
};

export class StationVisibility {
  static compute(
    origin: Vec2,
    facing: number,
    coneHalf: number,
    range: number,
    segments: VisibilitySegment[],
  ): Vec2[] {
    const nearby = segments.filter((s) => {
      const midX = (s.a.x + s.b.x) / 2;
      const midY = (s.a.y + s.b.y) / 2;
      const dx = midX - origin.x;
      const dy = midY - origin.y;
      return dx * dx + dy * dy <= range * range * 1.3;
    });

    const angles: number[] = [facing - coneHalf, facing, facing + coneHalf];
    const epsilon = 0.0002;
    for (const seg of nearby) {
      for (const endpoint of [seg.a, seg.b]) {
        const dx = endpoint.x - origin.x;
        const dy = endpoint.y - origin.y;
        const angle = Math.atan2(dy, dx);
        if (!angleInCone(angle, facing, coneHalf)) continue;
        angles.push(angle - epsilon, angle + epsilon);
      }
    }

    const hits: RayHit[] = [];
    for (const angle of angles) {
      const dir: Vec2 = { x: Math.cos(angle), y: Math.sin(angle) };
      let nearestT = range;
      let nearestPoint: Vec2 = { x: origin.x + dir.x * range, y: origin.y + dir.y * range };
      for (const seg of nearby) {
        const hit = raySegmentIntersection(origin, dir, seg.a, seg.b);
        if (hit && hit.t < nearestT) {
          nearestT = hit.t;
          nearestPoint = hit.point;
        }
      }
      hits.push({ angle, point: nearestPoint });
    }

    hits.sort((a, b) => a.angle - b.angle);
    return [origin, ...hits.map((hit) => hit.point)];
  }
}
