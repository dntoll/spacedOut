import type { Vec2 } from '../types';
import type { Drawing, RadialPaint } from './Drawing';
import { StarField } from './StarField';

export class SpaceBackground {
  private readonly stars = new StarField();

  resize(size: { width: number; height: number }): void {
    this.stars.resize(size.width, size.height);
  }

  draw(drawing: Drawing, cameraPosition: Vec2): void {
    drawing.clear('#0a1426');
    this.stars.draw(drawing, cameraPosition);
  }

  drawVignette(drawing: Drawing): void {
    const { width, height } = drawing.size;
    const center = { x: width / 2, y: height / 2 };
    const vignette: RadialPaint = {
      from: center,
      fromRadius: Math.min(width, height) * 0.18,
      to: center,
      toRadius: Math.max(width, height) * 0.72,
      stops: [
        { offset: 0, color: 'rgba(0,0,0,0)' },
        { offset: 1, color: 'rgba(0,4,12,.72)' },
      ],
    };
    drawing.rectangle({ x: 0, y: 0 }, { width, height }, vignette);
  }
}
