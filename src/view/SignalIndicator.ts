import type * as Model from '../model';
import { normalize, sub } from '../math';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing } from './Drawing';

const SEGMENT_LENGTH = 140;
const SIGNAL_COLOR = '#ff3b3b';
const DRONE_COLOR = '#5db8ff';
const PIRATE_COLOR = '#ff6a4a';
const WAVE_PERIOD = 1.4;
const WAVE_ARC_COUNT = 3;
const WAVE_MAX_RADIUS = 220;
const WAVE_WIDTH = 2;

export class SignalIndicator {
  draw(drawing: Drawing, model: Model.Game, camera: Camera): void {
    const size = drawing.size;
    const center = { x: size.width / 2, y: size.height / 2 };
    const direction = this.aimDirection(model, camera);
    if (direction) {
      const edge = this.edgePoint(center, direction, size);
      const inner = { x: edge.x - direction.x * SEGMENT_LENGTH, y: edge.y - direction.y * SEGMENT_LENGTH };
      drawing.dashedLine(edge, inner, SIGNAL_COLOR, 3);
      this.drawWave(drawing, edge, direction, SIGNAL_COLOR, model.elapsed, WAVE_MAX_RADIUS);
    }

    const bounds = camera.getVisibleWorldBounds(size);
    this.drawThreatWaves(drawing, center, size, bounds, camera.focusPosition, model.elapsed,
      model.droneField.forEach.bind(model.droneField), DRONE_COLOR, (threat) => threat.isHunting);
    this.drawThreatWaves(drawing, center, size, bounds, camera.focusPosition, model.elapsed,
      model.pirateField.forEachPirate.bind(model.pirateField), PIRATE_COLOR, (threat) => threat.isHunting);
  }

  private drawThreatWaves<T extends { position: Vec2 }>(
    drawing: Drawing,
    center: Vec2,
    size: { width: number; height: number },
    bounds: { left: number; top: number; right: number; bottom: number },
    focus: Vec2,
    elapsed: number,
    forEachThreat: (visitor: (threat: T) => void) => void,
    color: string,
    isHunting: (threat: T) => boolean,
  ): void {
    forEachThreat((threat) => {
      if (!isHunting(threat)) return;
      if (threat.position.x >= bounds.left && threat.position.x <= bounds.right
        && threat.position.y >= bounds.top && threat.position.y <= bounds.bottom) return;
      const direction = normalize(sub(threat.position, focus));
      if (direction.x === 0 && direction.y === 0) return;
      const edge = this.edgePoint(center, direction, size);
      this.drawWave(drawing, edge, direction, color, elapsed, WAVE_MAX_RADIUS);
    });
  }

  private drawWave(
    drawing: Drawing,
    edge: Vec2,
    outwardDir: Vec2,
    color: string,
    elapsed: number,
    maxRadius: number,
  ): void {
    const inwardAngle = Math.atan2(-outwardDir.y, -outwardDir.x);
    const halfSpread = Math.PI / 2;
    for (let index = 0; index < WAVE_ARC_COUNT; index++) {
      const phase = ((elapsed / WAVE_PERIOD) + index / WAVE_ARC_COUNT) % 1;
      const radius = phase * maxRadius;
      if (radius < 1) continue;
      const alpha = 1 - phase;
      drawing.arc(edge, radius, inwardAngle - halfSpread, inwardAngle + halfSpread, this.tint(color, alpha), WAVE_WIDTH);
    }
  }

  private tint(color: string, alpha: number): string {
    const hex = color.startsWith('#') ? color.slice(1) : color;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  }

  private edgePoint(center: Vec2, direction: Vec2, size: { width: number; height: number }): Vec2 {
    const candidates: number[] = [];
    if (direction.x > 0) candidates.push((size.width - center.x) / direction.x);
    else if (direction.x < 0) candidates.push(-center.x / direction.x);
    if (direction.y > 0) candidates.push((size.height - center.y) / direction.y);
    else if (direction.y < 0) candidates.push(-center.y / direction.y);
    const t = Math.min(...candidates.filter((value) => value > 0));
    return { x: center.x + direction.x * t, y: center.y + direction.y * t };
  }

  private aimDirection(model: Model.Game, camera: Camera): Vec2 | null {
    const destination = model.mission.destinationPosition;
    if (destination) {
      const dir = normalize(sub(destination, camera.focusPosition));
      if (dir.x !== 0 || dir.y !== 0) return dir;
    }
    return model.mission.signalDirection;
  }
}
