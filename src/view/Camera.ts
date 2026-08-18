import { clamp } from '../math';
import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';

export interface WorldBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const DRONE_THREAT_ZOOM_OUT = 0.25;
const DRONE_THREAT_FLOOR = 0.30;
const DESOLATE_ZOOM_OUT = 0.35;
const DESOLATE_FLOOR = 0.25;

export class Camera {
  private position: Vec2 = { x: 0, y: 0 };
  private zoomLevel = 1;
  private baseZoom = 1.15;

  get worldPosition(): Vec2 { return { ...this.position }; }
  get zoom(): number { return this.zoomLevel; }

  setBaseZoom(zoom: number): void { this.baseZoom = clamp(zoom, 0.5, 2); }

  update(target: Vec2, speed: number, dt: number, droneThreat = false, desolate = false): void {
    this.position = { ...target };
    let floor = 0.42;
    let offset = 0;
    if (droneThreat) { floor = Math.min(floor, DRONE_THREAT_FLOOR); offset += DRONE_THREAT_ZOOM_OUT; }
    if (desolate) { floor = Math.min(floor, DESOLATE_FLOOR); offset += DESOLATE_ZOOM_OUT; }
    const targetZoom = clamp(this.baseZoom - speed / 700 - offset, floor, this.baseZoom);
    this.zoomLevel += (targetZoom - this.zoomLevel) * Math.min(1, dt * 2.5);
  }

  screenToWorld(point: Vec2, viewport: { width: number; height: number }): Vec2 {
    return {
      x: this.position.x + (point.x - viewport.width / 2) / this.zoomLevel,
      y: this.position.y + (point.y - viewport.height / 2) / this.zoomLevel,
    };
  }

  getVisibleWorldBounds(viewport: { width: number; height: number }): WorldBounds {
    const halfWidth = viewport.width / (2 * this.zoomLevel);
    const halfHeight = viewport.height / (2 * this.zoomLevel);
    return {
      left: this.position.x - halfWidth,
      top: this.position.y - halfHeight,
      right: this.position.x + halfWidth,
      bottom: this.position.y + halfHeight,
    };
  }

  getVisibleWorldRadius(viewport: { width: number; height: number }): number {
    return Math.hypot(viewport.width, viewport.height) / (2 * this.zoomLevel);
  }

  drawWorld(drawing: Drawing, draw: () => void): void {
    drawing.withCamera(this.position, this.zoomLevel, draw);
  }
}
