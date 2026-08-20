import { length, sub } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing, RadialPaint } from './Drawing';
import type { StarLight, ShadowCasters } from './StarLight';

export class Freighter {
  draw(
    drawing: Drawing,
    freighter: Model.Freighter,
    viewCenter: Vec2,
    visibleRange: number,
    starLight: StarLight,
    casters: ShadowCasters | null,
    zoom: number,
  ): void {
    if (!freighter.isPlaced) return;
    if (length(sub(freighter.position, viewCenter)) > visibleRange + freighter.radius * 2) return;
    const r = freighter.radius;
    drawing.withTransform(freighter.position, freighter.angle, () => {
      const localLight = starLight.localDirection(freighter.angle, freighter.position);
      const shadow = starLight.shadowFactor(freighter.position, r, casters);
      const hull = starLight.bodyPaint(localLight, r, '#c8d2dc', '#2a3138', shadow);
      const body = [
        { x: r * 1.35, y: 0 },
        { x: r * 0.7, y: r * 0.42 },
        { x: -r * 0.95, y: r * 0.48 },
        { x: -r * 1.25, y: r * 0.2 },
        { x: -r * 1.25, y: -r * 0.2 },
        { x: -r * 0.95, y: -r * 0.48 },
        { x: r * 0.7, y: -r * 0.42 },
      ];
      drawing.withShadow('#9ad4ff', 18, () => {
        drawing.polygon(body, hull, 'rgba(180,210,230,.5)', 1.6 / zoom);
      });
      drawing.polygon(
        [
          { x: r * 0.15, y: r * 0.18 },
          { x: -r * 0.55, y: r * 0.22 },
          { x: -r * 0.55, y: -r * 0.22 },
          { x: r * 0.15, y: -r * 0.18 },
        ],
        '#1b2733',
      );
      const beacon: RadialPaint = {
        from: { x: r * 1.15, y: 0 }, fromRadius: 0,
        to: { x: r * 1.15, y: 0 }, toRadius: r * 0.55,
        stops: [
          { offset: 0, color: 'rgba(255,80,70,.9)' },
          { offset: 1, color: 'rgba(255,50,40,0)' },
        ],
      };
      drawing.circle({ x: r * 1.15, y: 0 }, r * 0.55, beacon);
    });
  }
}
