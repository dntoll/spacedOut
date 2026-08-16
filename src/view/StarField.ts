import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

export class StarField {
  private stars: Star[] = [];

  resize(width: number, height: number): void {
    const count = Math.ceil((width * height) / 5200);
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 1.35 + 0.25,
      alpha: Math.random() * 0.65 + 0.16,
    }));
  }

  draw(drawing: Drawing, camera: Vec2): void {
    const { width, height } = drawing.size;
    const driftX = camera.x * 0.025;
    const driftY = camera.y * 0.025;
    for (const star of this.stars) {
      const x = ((star.x * width - driftX) % width + width) % width;
      const y = ((star.y * height - driftY) % height + height) % height;
      drawing.rectangle({ x, y }, { width: star.size, height: star.size }, `rgba(190,220,255,${star.alpha})`);
    }
  }
}
