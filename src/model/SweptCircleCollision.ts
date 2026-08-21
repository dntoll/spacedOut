import { add, dot, length, normalize, scale, sub } from '../math';
import type { Vec2 } from '../types';
import type { PhysicsBody } from './PhysicsBody';

export interface PolygonObstacle extends PhysicsBody {
  vertices: number[];
}

export interface CapsuleObstacle extends PhysicsBody {
  a: Vec2;
  b: Vec2;
  wallRadius: number;
}

// A wall built from traced bitmap contours: an explicit polyline of local-space
// vertices (collinear runs already merged) with a wall thickness. `closed` loops
// surround rooms; open chains form the hull arc and the entrance opening. The
// swept test iterates each edge as a capsule of radius `wallRadius`, so a long
// merged wall is one continuous edge rather than a stack of rounded squares.
export interface WallChain extends PhysicsBody {
  localVertices: Vec2[];
  closed: boolean;
  wallRadius: number;
}

export type ShipObstacle = PolygonObstacle | CapsuleObstacle | WallChain;

export const isCapsuleObstacle = (obstacle: ShipObstacle): obstacle is CapsuleObstacle =>
  'a' in obstacle && 'b' in obstacle && 'wallRadius' in obstacle && !('localVertices' in obstacle);

export const isWallChain = (obstacle: ShipObstacle): obstacle is WallChain =>
  'localVertices' in obstacle && 'wallRadius' in obstacle;

export interface SweepHit {
  time: number;
  normal: Vec2;
  obstacle: ShipObstacle;
}

interface LocalHit { time: number; normal: Vec2 }

export class SweptCircleCollision {
  static find(start: Vec2, end: Vec2, radius: number, obstacle: ShipObstacle): SweepHit | undefined {
    const localStart = this.toLocal(start, obstacle);
    const localEnd = this.toLocal(end, obstacle);
    let polygon: Vec2[];
    let edgeRadius: number;
    let edgeCount: number;
    if (isWallChain(obstacle)) {
      polygon = obstacle.localVertices;
      edgeRadius = radius + obstacle.wallRadius;
      edgeCount = obstacle.closed ? polygon.length : polygon.length - 1;
    } else {
      const poly = obstacle as PolygonObstacle;
      polygon = poly.vertices.map((variation, index) => {
        const angle = index / poly.vertices.length * Math.PI * 2;
        return { x: Math.cos(angle) * poly.radius * variation, y: Math.sin(angle) * poly.radius * variation };
      });
      edgeRadius = radius;
      edgeCount = polygon.length;
    }
    const hits: LocalHit[] = [];

    for (let i = 0; i < edgeCount; i++) {
      const edgeStart = polygon[i];
      const edgeEnd = polygon[(i + 1) % polygon.length];
      hits.push(...this.edgeCapsuleHits(localStart, localEnd, edgeStart, edgeEnd, edgeRadius));
    }

    if (hits.length === 0) return undefined;
    const earliest = Math.min(...hits.map((hit) => hit.time));
    const simultaneous = hits.filter((hit) => Math.abs(hit.time - earliest) < 0.0001);
    const combined = normalize(simultaneous.reduce((sum, hit) => add(sum, hit.normal), { x: 0, y: 0 }));
    const localNormal = length(combined) > 0 ? combined : simultaneous[0].normal;
    return { time: earliest, normal: this.rotate(localNormal, obstacle.angle), obstacle };
  }

  static findCapsule(start: Vec2, end: Vec2, radius: number, obstacle: CapsuleObstacle): SweepHit | undefined {
    const combined = radius + obstacle.wallRadius;
    const hits = this.edgeCapsuleHits(start, end, obstacle.a, obstacle.b, combined);
    if (hits.length === 0) return undefined;
    const earliest = Math.min(...hits.map((hit) => hit.time));
    const simultaneous = hits.filter((hit) => Math.abs(hit.time - earliest) < 0.0001);
    const combinedNormal = normalize(simultaneous.reduce((sum, hit) => add(sum, hit.normal), { x: 0, y: 0 }));
    const normal = length(combinedNormal) > 0 ? combinedNormal : simultaneous[0].normal;
    return { time: earliest, normal, obstacle };
  }

  private static edgeCapsuleHits(start: Vec2, end: Vec2, a: Vec2, b: Vec2, radius: number): LocalHit[] {
    const hits: LocalHit[] = [];
    const movement = sub(end, start);
    const edge = sub(b, a);
    const edgeLengthSquared = dot(edge, edge);
    if (edgeLengthSquared < 0.000001) return hits;
    const edgeLength = Math.sqrt(edgeLengthSquared);
    const outward = { x: edge.y / edgeLength, y: -edge.x / edgeLength };

    for (const normal of [outward, scale(outward, -1)]) {
      const denominator = dot(movement, normal);
      if (denominator >= -0.000001) continue;
      const time = (dot(a, normal) + radius - dot(start, normal)) / denominator;
      if (time < 0 || time > 1) continue;
      const point = add(start, scale(movement, time));
      const projection = dot(sub(point, a), edge) / edgeLengthSquared;
      if (projection >= 0 && projection <= 1) hits.push({ time, normal });
    }

    const startClosest = this.closestPointOnSegment(start, a, b);
    const startOffset = sub(start, startClosest);
    if (length(startOffset) < radius - 0.0001) {
      const insideNormal = dot(sub(start, a), outward) <= 0 ? outward : normalize(startOffset);
      hits.push({ time: 0, normal: length(insideNormal) > 0 ? insideNormal : outward });
    }

    const atA = this.movingPointCircleHit(start, end, a, radius);
    const atB = this.movingPointCircleHit(start, end, b, radius);
    if (atA) hits.push(atA);
    if (atB) hits.push(atB);
    return hits;
  }

  private static movingPointCircleHit(start: Vec2, end: Vec2, center: Vec2, radius: number): LocalHit | undefined {
    const movement = sub(end, start);
    const offset = sub(start, center);
    const a = dot(movement, movement);
    const c = dot(offset, offset) - radius * radius;
    if (c < -0.0001) {
      const normal = normalize(offset);
      return { time: 0, normal: length(normal) > 0 ? normal : { x: 1, y: 0 } };
    }
    if (a < 0.000001) return undefined;
    const b = 2 * dot(offset, movement);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return undefined;
    const root = Math.sqrt(discriminant);
    const time = (-b - root) / (2 * a);
    if (time < 0 || time > 1) return undefined;
    const point = add(start, scale(movement, time));
    const normal = normalize(sub(point, center));
    if (dot(movement, normal) >= 0) return undefined;
    return { time, normal };
  }

  private static closestPointOnSegment(point: Vec2, a: Vec2, b: Vec2): Vec2 {
    const edge = sub(b, a);
    const amount = Math.max(0, Math.min(1, dot(sub(point, a), edge) / dot(edge, edge)));
    return add(a, scale(edge, amount));
  }

  private static toLocal(point: Vec2, obstacle: PhysicsBody): Vec2 {
    return this.rotate(sub(point, obstacle.position), -obstacle.angle);
  }

  private static rotate(point: Vec2, angle: number): Vec2 {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return { x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine };
  }
}
