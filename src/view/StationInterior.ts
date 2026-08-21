import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';
import type { StarLight } from './StarLight';
import { drawWallChain } from './StationOutline';

const ROOF_FILL = '#000000';
const FLOOR_FILL = '#3a3a40';
const FLOOR_TINT = 'rgba(120,120,130,.18)';
const INTERIOR_WALL_FILL = '#2a2a30';
const INTERIOR_WALL_FACE = '#4a4a52';
const CENTRAL_FLOOR = 'rgba(90,90,100,.24)';
const CENTRAL_RING = 'rgba(170,170,180,.30)';
const CENTRAL_DOME = 'rgba(110,110,120,.14)';

export class StationInterior {
  draw(drawing: Drawing, station: Model.Station, starLight: StarLight, zoom: number): void {
    if (!station.isPlaced) return;
    const rotation = station.entranceAngle;
    const lineWidth = Math.max(1, 2 / zoom);

    this.drawRoof(drawing, station);
    this.drawFloor(drawing, station);

    for (const room of station.rooms) {
      if (room.kind === 'entrance') continue;
      const isCentral = room.kind === 'central';
      drawing.withTransform(room.position, rotation, () => {
        const hw = room.halfWidth;
        const hh = room.halfHeight;
        drawing.polygon(
          [{ x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }, { x: -hw, y: -hh }],
          isCentral ? CENTRAL_FLOOR : FLOOR_TINT,
        );
      });
    }

    const central = station.centralCenter!;
    const centralR = station.centralRadius;
    drawing.circle(central, centralR, CENTRAL_DOME);
    drawing.circle(central, centralR * 0.7, CENTRAL_RING, undefined, 0);
    drawing.arc(central, centralR * 0.7, 0, Math.PI * 2, 'rgba(180,120,72,.22)', lineWidth);
    drawing.line(
      { x: central.x - centralR * 0.7, y: central.y },
      { x: central.x + centralR * 0.7, y: central.y },
      'rgba(150,96,56,.3)',
      lineWidth,
    );
    drawing.line(
      { x: central.x, y: central.y - centralR * 0.7 },
      { x: central.x, y: central.y + centralR * 0.7 },
      'rgba(150,96,56,.3)',
      lineWidth,
    );

    station.forEachInteriorWall((wall) => {
      const lineWidth = Math.max(2, wall.wallRadius * 2);
      drawWallChain(drawing, wall, INTERIOR_WALL_FILL, INTERIOR_WALL_FACE, lineWidth);
    });
  }

  private drawRoof(drawing: Drawing, station: Model.Station): void {
    // The rock disc is one filled circle of the station radius; the floor pass
    // overdraws the carved rooms and corridors on top. One fill instead of
    // thousands of per-cell quads.
    drawing.circle(station.center!, station.outerRadius, ROOF_FILL);
  }

  private drawFloor(drawing: Drawing, station: Model.Station): void {
    const carver = station.carver;
    if (!carver) return;
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
    if (paths.length > 0) drawing.fillPolygons(paths, FLOOR_FILL);
  }
}
