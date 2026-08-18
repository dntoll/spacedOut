import { clamp, length } from '../math';
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
const LOOKAHEAD_GAIN = 0.3;
const LOOKAHEAD_EASE = 2.5;

export class Camera {
  private position: Vec2 = { x: 0, y: 0 };
  private focus: Vec2 = { x: 0, y: 0 };
  private offset: Vec2 = { x: 0, y: 0 };
  private viewport: { width: number; height: number } = { width: 0, height: 0 };
  private zoomLevel = 1;
  private baseZoom = 1.15;

  get worldPosition(): Vec2 { return { ...this.position }; }
  get focusPosition(): Vec2 { return { ...this.focus }; }
  get zoom(): number { return this.zoomLevel; }

  setBaseZoom(zoom: number): void { this.baseZoom = clamp(zoom, 0.5, 2); }
  setViewport(viewport: { width: number; height: number }): void { this.viewport = { ...viewport }; }

  update(target: Vec2, velocity: Vec2, dt: number, droneThreat = false, desolate = false): void {
    this.focus = { ...target };
    const speed = length(velocity);
    let floor = 0.42;
    let zoomOffset = 0;
    if (droneThreat) { floor = Math.min(floor, DRONE_THREAT_FLOOR); zoomOffset += DRONE_THREAT_ZOOM_OUT; }
    if (desolate) { floor = Math.min(floor, DESOLATE_FLOOR); zoomOffset += DESOLATE_ZOOM_OUT; }
    const targetZoom = clamp(this.baseZoom - speed / 700 - zoomOffset, floor, this.baseZoom);
    this.zoomLevel += (targetZoom - this.zoomLevel) * Math.min(1, dt * 2.5);

    const capX = this.viewport.width / 6 / this.zoomLevel;
    const capY = this.viewport.height / 6 / this.zoomLevel;
    const desiredX = clamp(velocity.x * LOOKAHEAD_GAIN, -capX, capX);
    const desiredY = clamp(velocity.y * LOOKAHEAD_GAIN, -capY, capY);
    const ease = Math.min(1, dt * LOOKAHEAD_EASE);
    this.offset.x += (desiredX - this.offset.x) * ease;
    this.offset.y += (desiredY - this.offset.y) * ease;

    this.position = { x: this.focus.x + this.offset.x, y: this.focus.y + this.offset.y };
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
