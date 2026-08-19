import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';
import type { StarLight } from './StarLight';

const ARM_COUNT = 4;

export class SpaceStation {
  draw(drawing: Drawing, station: Model.SpaceStation, zoom: number, starLight: StarLight): void {
    drawing.withTransform(station.position, station.angle, () => {
      const radius = station.radius;
      const localLight = starLight.localDirection(station.angle);
      const hullPaint = starLight.bodyPaint(localLight, radius, '#75452e', '#140b08', 0);
      const outline = station.vertices.map((variation, index) => {
        const angle = index / station.vertices.length * Math.PI * 2;
        return {
          x: Math.cos(angle) * radius * variation,
          y: Math.sin(angle) * radius * variation,
        };
      });
      drawing.polygon(outline, hullPaint, 'rgba(205,118,65,.72)', 3 / zoom);

      for (let arm = 0; arm < ARM_COUNT; arm++) {
        drawing.withTransform({ x: 0, y: 0 }, arm * Math.PI / 2, () => {
          drawing.rectangle(
            { x: radius * 0.18, y: -radius * 0.075 },
            { width: radius * 0.72, height: radius * 0.15 },
            arm === 2 ? '#2b1913' : '#603723',
          );
          drawing.rectangle(
            { x: radius * 0.68, y: -radius * 0.16 },
            { width: radius * 0.22, height: radius * 0.32 },
            arm === 1 ? '#261712' : '#855033',
          );
          drawing.line(
            { x: radius * 0.25, y: -radius * 0.11 },
            { x: radius * 0.82, y: -radius * 0.11 },
            'rgba(214,132,78,.48)',
            4 / zoom,
          );
        });
      }

      drawing.circle({ x: 0, y: 0 }, radius * 0.46, '#281710', '#9a5938', 5 / zoom);
      drawing.circle({ x: 0, y: 0 }, radius * 0.31, '#5d3422', '#c17849', 3 / zoom);
      drawing.circle({ x: 0, y: 0 }, radius * 0.14, '#120c0a', '#6f402b', 3 / zoom);

      for (let index = 0; index < 16; index++) {
        const angle = index / 16 * Math.PI * 2;
        const position: Vec2 = {
          x: Math.cos(angle) * radius * 0.38,
          y: Math.sin(angle) * radius * 0.38,
        };
        const dead = index % 5 === 0 || index % 7 === 0;
        drawing.circle(position, radius * 0.018, dead ? '#180d09' : '#b56b38');
      }

      drawing.line(
        { x: -radius * 0.12, y: -radius * 0.12 },
        { x: radius * 0.18, y: radius * 0.2 },
        '#1b0f0b',
        radius * 0.035,
      );
      drawing.circle({ x: radius * 0.72, y: radius * 0.04 }, radius * 0.09, '#160d0a', '#ae623b', 2 / zoom);
    });
  }
}
