import { describe, expect, it } from 'vitest';
import { obstacleOutline, obstacleSegments, raySegmentT, type Occluder } from './LineOfSight';

describe('LineOfSight', () => {
  it('raySegmentT hits a crossing segment and reports the ray parameter', () => {
    // Ray from origin going +x; vertical segment at x=2 spanning y=[-1,1].
    const seg = { ax: 2, ay: -1, bx: 2, by: 1 };
    const t = raySegmentT(0, 0, 1, 0, seg);
    expect(t).toBe(2);
  });

  it('raySegmentT returns null when the ray is parallel to the segment', () => {
    const seg = { ax: 0, ay: 5, bx: 10, by: 5 };
    expect(raySegmentT(0, 0, 1, 0, seg)).toBeNull();
  });

  it('raySegmentT returns null when the hit is behind the ray origin', () => {
    const seg = { ax: -5, ay: -1, bx: -5, by: 1 };
    expect(raySegmentT(0, 0, 1, 0, seg)).toBeNull();
  });

  it('raySegmentT returns null when the ray misses the segment ends', () => {
    const seg = { ax: 2, ay: 10, bx: 2, by: 20 };
    expect(raySegmentT(0, 0, 1, 0, seg)).toBeNull();
  });

  it('obstacleOutline rotates a wall chain polyline into world space', () => {
    const wall: Occluder = {
      position: { x: 10, y: 0 },
      angle: 0,
      radius: 5,
      localVertices: [{ x: -2, y: 0 }, { x: 2, y: 0 }],
      closed: false,
    };
    expect(obstacleOutline(wall)).toEqual([
      { x: 8, y: 0 },
      { x: 12, y: 0 },
    ]);
  });

  it('obstacleOutline builds a radial polygon from vertex variations', () => {
    const poly: Occluder = { position: { x: 0, y: 0 }, angle: 0, radius: 10, vertices: [1, 1, 1, 1] };
    const outline = obstacleOutline(poly);
    expect(outline).toHaveLength(4);
    expect(outline[0]).toEqual({ x: 10, y: 0 });
    expect(outline[1].x).toBeCloseTo(0, 6);
    expect(outline[1].y).toBeCloseTo(10, 6);
  });

  it('obstacleSegments emits a closed loop with as many edges as vertices', () => {
    const wall: Occluder = {
      position: { x: 0, y: 0 },
      angle: 0,
      radius: 5,
      localVertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      closed: true,
    };
    expect(obstacleSegments(wall)).toHaveLength(3);
  });

  it('obstacleSegments emits an open chain with one fewer edges than vertices', () => {
    const wall: Occluder = {
      position: { x: 0, y: 0 },
      angle: 0,
      radius: 5,
      localVertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      closed: false,
    };
    expect(obstacleSegments(wall)).toHaveLength(2);
  });
});
