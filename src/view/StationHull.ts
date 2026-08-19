import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';
import type { StarLight } from './StarLight';

const HULL_PLATE = '#4a2c18';
const HULL_PLATE_DARK = '#241608';
const HULL_HIGHLIGHT = '#7a4e2c';
const ENTRANCE_GLOW = '#ffb24a';

export class StationHull {
  draw(drawing: Drawing, station: Model.Station, starLight: StarLight, zoom: number): void {
    if (!station.isPlaced) return;
    const light = starLight.direction;

    station.forEachHullWall((wall) => {
      const hl = wall.halfLength;
      const hw = wall.halfWidth;
      drawing.withTransform(wall.position, wall.angle, () => {
        drawing.polygon(
          [{ x: hl, y: -hw }, { x: hl, y: hw }, { x: -hl, y: hw }, { x: -hl, y: -hw }],
          HULL_PLATE_DARK,
          HULL_PLATE,
          Math.max(1, 1.5 / zoom),
        );
        const perp: Vec2 = { x: -Math.sin(wall.angle), y: Math.cos(wall.angle) };
        const lit = perp.x * light.x + perp.y * light.y >= 0 ? 1 : -1;
        drawing.line(
          { x: hl, y: lit * hw },
          { x: -hl, y: lit * hw },
          HULL_HIGHLIGHT,
          Math.max(1, hw * 0.4),
        );
      });
    });

    this.drawEntranceBeacons(drawing, station, zoom);
  }

  private drawEntranceBeacons(drawing: Drawing, station: Model.Station, zoom: number): void {
    const entrance = station.entrancePosition;
    if (!entrance) return;
    const angle = station.entranceAngle;
    const perp: Vec2 = { x: -Math.sin(angle), y: Math.cos(angle) };
    const spread = station.entranceRadius * 0.85;
    for (const sign of [-1, 1]) {
      const p: Vec2 = { x: entrance.x + perp.x * spread * sign, y: entrance.y + perp.y * spread * sign };
      drawing.withShadow(ENTRANCE_GLOW, 14, () => {
        drawing.circle(p, Math.max(2, 4 / zoom), 'rgba(255,178,74,.4)', ENTRANCE_GLOW, 1.5);
      });
    }
  }
}
