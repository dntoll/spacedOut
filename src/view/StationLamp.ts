import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing, RadialPaint } from './Drawing';

const DIM_ALPHA = 0.62;
const RAY_COUNT = 180;

interface Segment { ax: number; ay: number; bx: number; by: number }

export class StationLamp {
  private stationId = '';
  private cachedDimPaths: Vec2[][] = [];
  private polygon: Vec2[] = [];

  reset(): void {
    this.stationId = '';
    this.cachedDimPaths = [];
    this.polygon = [];
  }

  draw(drawing: Drawing, station: Model.Station, shipPosition: Vec2, cameraPosition: Vec2, zoom: number, radius: number): void {
    if (!station.isPlaced || radius <= 0) return;
    this.ensureDimPaths(station);
    this.polygon = this.computeVisibility(station, shipPosition, radius);

    drawing.beginShadowLayer();
    drawing.withCamera(cameraPosition, zoom, () => {
      if (this.cachedDimPaths.length > 0) drawing.fillPolygons(this.cachedDimPaths, `rgba(0,0,0,${DIM_ALPHA})`);
      if (this.polygon.length >= 3) {
        const paint: RadialPaint = {
          from: { ...shipPosition }, fromRadius: 0,
          to: { ...shipPosition }, toRadius: radius,
          stops: [
            { offset: 0, color: 'rgba(255,255,255,1)' },
            { offset: 0.55, color: 'rgba(255,255,255,0.92)' },
            { offset: 1, color: 'rgba(255,255,255,0)' },
          ],
        };
        drawing.polygon(this.polygon, paint);
      }
    });
    drawing.endShadowLayer();
    drawing.compositeShadowLayer('multiply');
  }

  private ensureDimPaths(station: Model.Station): void {
    const center = station.center!;
    const id = `${center.x}:${center.y}:${station.outerRadius}:${station.entranceAngle}`;
    if (id === this.stationId) return;
    this.stationId = id;
    this.cachedDimPaths = this.buildCarvedCellPaths(station);
  }

  private buildCarvedCellPaths(station: Model.Station): Vec2[][] {
    const carver = station.carver;
    if (!carver) return [];
    const center = station.center!;
    const rotation = station.entranceAngle;
    const half = carver.cellSize / 2 + 0.5;
    const paths: Vec2[][] = [];
    for (let r = 0; r < carver.gridN; r++) {
      for (let c = 0; c < carver.gridN; c++) {
        if (carver.bitmap[r * carver.gridN + c] !== 1) continue;
        const local = carver.cellCenterLocal(c, r);
        const corners: Vec2[] = [
          { x: local.x - half, y: local.y - half },
          { x: local.x + half, y: local.y - half },
          { x: local.x + half, y: local.y + half },
          { x: local.x - half, y: local.y + half },
        ];
        paths.push(corners.map((p) => carver.localToWorld(p, center, rotation)));
      }
    }
    return paths;
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
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i];
        const b = outline[(i + 1) % outline.length];
        segments.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
      }
    });
    return segments;
  }
}

const obstacleOutline = (body: { position: Vec2; angle: number; radius: number; vertices: number[] }): Vec2[] => {
  const wall = body as { position: Vec2; angle: number; halfLength?: number; halfWidth?: number };
  if (wall.halfLength !== undefined && wall.halfWidth !== undefined) {
    const cos = Math.cos(body.angle);
    const sin = Math.sin(body.angle);
    const hl = wall.halfLength;
    const hw = wall.halfWidth;
    const local: Array<[number, number]> = [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]];
    return local.map(([lx, ly]) => ({ x: body.position.x + lx * cos - ly * sin, y: body.position.y + lx * sin + ly * cos }));
  }
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  const { position, radius, vertices } = body;
  const out: Vec2[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = (i / vertices.length) * Math.PI * 2;
    const lx = Math.cos(a) * radius * vertices[i];
    const ly = Math.sin(a) * radius * vertices[i];
    out.push({ x: position.x + lx * cos - ly * sin, y: position.y + lx * sin + ly * cos });
  }
  return out;
};

const raySegmentT = (ox: number, oy: number, dx: number, dy: number, s: Segment): number | null => {
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
