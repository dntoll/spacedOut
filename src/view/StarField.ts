import type { Vec2 } from '../types';

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

  draw(ctx: CanvasRenderingContext2D, width: number, height: number, camera: Vec2): void {
    const driftX = camera.x * 0.025;
    const driftY = camera.y * 0.025;
    for (const star of this.stars) {
      const x = ((star.x * width - driftX) % width + width) % width;
      const y = ((star.y * height - driftY) % height + height) % height;
      ctx.fillStyle = `rgba(190,220,255,${star.alpha})`;
      ctx.fillRect(x, y, star.size, star.size);
    }
  }
}
