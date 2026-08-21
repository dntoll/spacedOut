import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';
import type { ShipObstacle, WallChain, PolygonObstacle } from '../model/SweptCircleCollision';
import { isWallChain } from '../model/SweptCircleCollision';
import { wallChainWorldVertices } from '../model/WallChainCollision';

// World-space outline of a station obstacle: explicit vertices for wall chains
// (traced contours, gates, the hull arc), or the radial reconstruction for
// machinery and asteroids.
export const stationOutline = (obstacle: ShipObstacle): Vec2[] => {
  if (isWallChain(obstacle)) return wallChainWorldVertices(obstacle as WallChain);
  const poly = obstacle as PolygonObstacle;
  const cos = Math.cos(poly.angle);
  const sin = Math.sin(poly.angle);
  const out: Vec2[] = [];
  for (let i = 0; i < poly.vertices.length; i++) {
    const a = (i / poly.vertices.length) * Math.PI * 2;
    const lx = Math.cos(a) * poly.radius * poly.vertices[i];
    const ly = Math.sin(a) * poly.radius * poly.vertices[i];
    out.push({ x: poly.position.x + lx * cos - ly * sin, y: poly.position.y + lx * sin + ly * cos });
  }
  return out;
};

// Stroke a wall chain as a thick band along its merged vertices. Closed loops
// wrap; open chains (hull arc, entrance opening) stroke as a polyline.
export const drawWallChain = (
  drawing: Drawing,
  chain: WallChain,
  fill: string,
  stroke: string,
  lineWidth: number,
): void => {
  const pts = wallChainWorldVertices(chain);
  if (pts.length < 2) return;
  const n = pts.length;
  const edgeCount = chain.closed ? n : n - 1;
  for (let i = 0; i < edgeCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    drawing.line(a, b, fill, lineWidth);
  }
  if (stroke) {
    for (let i = 0; i < edgeCount; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      drawing.line(a, b, stroke, Math.max(1, lineWidth * 0.25));
    }
  }
};
