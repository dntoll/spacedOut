import { clamp } from '../math';
import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';

export class Camera {
  private position: Vec2 = { x: 0, y: 0 };
  private zoomLevel = 1;

  get worldPosition(): Vec2 { return { ...this.position }; }
  get zoom(): number { return this.zoomLevel; }

  update(target: Vec2, speed: number, dt: number): void {
    this.position = { ...target };
    const targetZoom = clamp(1.15 - speed / 700, 0.42, 1.15);
    this.zoomLevel += (targetZoom - this.zoomLevel) * Math.min(1, dt * 2.5);
  }

  screenToWorld(point: Vec2, viewport: { width: number; height: number }): Vec2 {
    return {
      x: this.position.x + (point.x - viewport.width / 2) / this.zoomLevel,
      y: this.position.y + (point.y - viewport.height / 2) / this.zoomLevel,
    };
  }

  drawWorld(drawing: Drawing, draw: () => void): void {
    drawing.withCamera(this.position, this.zoomLevel, draw);
  }
}
