import { length, sub } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing, RadialPaint } from './Drawing';

export class Star {
  draw(drawing: Drawing, star: Model.Star, viewCenter: Vec2, visibleRange: number): void {
    if (!star.isPlaced) return;
    if (length(sub(star.position, viewCenter)) > visibleRange + star.radius * 2) return;
    drawing.withAdditiveBlend(() => {
      const corona: RadialPaint = {
        from: { ...star.position }, fromRadius: star.radius * 0.2,
        to: { ...star.position }, toRadius: star.radius * 1.85,
        stops: [
          { offset: 0, color: 'rgba(255,252,240,0.95)' },
          { offset: 0.18, color: 'rgba(255,236,180,0.85)' },
          { offset: 0.45, color: 'rgba(255,198,110,0.35)' },
          { offset: 1, color: 'rgba(255,160,80,0)' },
        ],
      };
      drawing.circle(star.position, star.radius * 1.85, corona);
      drawing.withShadow('#fff4c8', 40, () => {
        drawing.circle(star.position, star.radius * 0.55, '#fff8e8');
      });
    });
  }
}
