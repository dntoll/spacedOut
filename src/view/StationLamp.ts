import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing, RadialPaint } from './Drawing';
import type { StationRoof } from './StationRoof';
import { isWallChain } from '../model/SweptCircleCollision';
import { obstacleOutline, raySegmentT, type Segment } from './LineOfSight';

// The lamp owns a single multiply-composite pass: a black disc covers the entire
// station (so everything starts dark — roof, floor, and walls alike), then the
// lamp's visibility polygon lifts lit cells to bright. Visibility is wall-accurate
// (raycast against wall segments including diagonal edges), not cell-approximate,
// so nothing beyond a wall or closed door is visible regardless of bitmap state.
const BLACK_ALPHA = 1.0;
const RAY_COUNT = 360;

export class StationLamp {
  private polygon: Vec2[] = [];

  reset(): void {
    this.polygon = [];
  }

  draw(drawing: Drawing, station: Model.Station, shipPosition: Vec2, cameraPosition: Vec2, zoom: number, radius: number, roof: StationRoof): void {
    if (!station.isPlaced) return;
    roof.update(station, shipPosition);
    this.polygon = radius > 0 ? this.computeVisibility(station, shipPosition, radius) : [];

    drawing.beginShadowLayer();
    drawing.withCamera(cameraPosition, zoom, () => {
      // Black disc over the entire station: everything starts dark (roof, floor,
      // walls), so nothing beyond a wall is visible regardless of bitmap state.
      drawing.circle(station.center!, station.outerRadius, `rgba(0,0,0,${BLACK_ALPHA})`);
      if (this.polygon.length >= 3) {
        const paint: RadialPaint = {
          from: { ...shipPosition }, fromRadius: 0,
          to: { ...shipPosition }, toRadius: radius,
          stops: [
            { offset: 0, color: 'rgba(255,255,255,1)' },
            { offset: 0.35, color: 'rgba(255,255,255,0.98)' },
            { offset: 0.7, color: 'rgba(255,255,255,0.5)' },
            { offset: 1, color: 'rgba(255,255,255,0)' },
          ],
        };
        drawing.polygon(this.polygon, paint);
      }
    });
    drawing.endShadowLayer();
    drawing.compositeShadowLayer('multiply');
  }

  private computeVisibility(station: Model.Station, origin: Vec2, radius: number): Vec2[] {
    const segments = this.gatherSegments(station, origin, radius);
    // Uniform angular rays, each stopped at the nearest wall (or the radius).
    // One hit per angle, emitted in angular order, yields a simple star polygon
    // (never self-intersecting) regardless of obstacle density.
    const pts: Vec2[] = [];
    for (let i = 0; i < RAY_COUNT; i++) {
      const a = (i / RAY_COUNT) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let bestT = radius;
      for (const s of segments) {
        const t = raySegmentT(origin.x, origin.y, dx, dy, s);
        if (t !== null && t < bestT) bestT = t;
      }
      pts.push({ x: origin.x + dx * bestT, y: origin.y + dy * bestT });
    }
    return pts;
  }

  private gatherSegments(station: Model.Station, origin: Vec2, radius: number): Segment[] {
    const segments: Segment[] = [];
    station.forEachObstacle((obstacle) => {
      const dx = obstacle.position.x - origin.x;
      const dy = obstacle.position.y - origin.y;
      const reach = radius + obstacle.radius;
      if (dx * dx + dy * dy > reach * reach) return;
      const outline = obstacleOutline(obstacle);
      const closed = isWallChain(obstacle) ? (obstacle as { closed: boolean }).closed : true;
      const edgeCount = closed ? outline.length : outline.length - 1;
      for (let i = 0; i < edgeCount; i++) {
        const a = outline[i];
        const b = outline[(i + 1) % outline.length];
        segments.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
      }
    });
    return segments;
  }
}
