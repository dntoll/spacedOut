import { scale } from '../math';
import type * as Model from '../model';
import type { Drawing } from './Drawing';

const LASER_LENGTH = 22;
const LASER_COLOR = '#ff3b4d';
const LASER_GLOW = '#ff2a3a';

export class LaserField {
  draw(drawing: Drawing, field: Model.LaserField): void {
    drawing.withAdditiveBlend(() => {
      field.forEach((laser) => {
        const forward = { x: Math.cos(laser.angle), y: Math.sin(laser.angle) };
        const tail = scale(forward, -LASER_LENGTH);
        drawing.withShadow(LASER_GLOW, 12, () => {
          drawing.line({ x: laser.position.x + tail.x, y: laser.position.y + tail.y }, laser.position, LASER_COLOR, 3);
        });
      });
    });
  }
}
