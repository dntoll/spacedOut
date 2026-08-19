import type * as Model from '../model';
import type { Drawing } from './Drawing';
import type { StarLight } from './StarLight';

const FLOOR_TINT = 'rgba(40,28,18,.22)';
const INTERIOR_WALL_FILL = '#3a2418';
const INTERIOR_WALL_FACE = '#5a3a22';
const INTERIOR_WALL_EDGE = 'rgba(150,96,56,.4)';
const CENTRAL_FLOOR = 'rgba(70,52,34,.28)';
const CENTRAL_RING = 'rgba(180,120,72,.35)';
const CENTRAL_DOME = 'rgba(120,84,52,.16)';

export class StationInterior {
  draw(drawing: Drawing, station: Model.Station, starLight: StarLight, zoom: number): void {
    if (!station.isPlaced) return;
    const rotation = station.entranceAngle;
    const lineWidth = Math.max(1, 2 / zoom);

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
      const hl = wall.halfLength;
      const hw = wall.halfWidth;
      drawing.withTransform(wall.position, wall.angle, () => {
        drawing.polygon(
          [{ x: hl, y: -hw }, { x: hl, y: hw }, { x: -hl, y: hw }, { x: -hl, y: -hw }],
          INTERIOR_WALL_FILL,
          INTERIOR_WALL_FACE,
          Math.max(1, 1.5 / zoom),
        );
      });
    });
  }
}
