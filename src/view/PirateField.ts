import { length, scale, sub } from '../math';
import type * as Model from '../model';
import type { Camera } from './Camera';
import type { Drawing, RadialPaint } from './Drawing';

const DETECTION_RING_COLOR = 'rgba(255,90,90,.30)';
const ESCAPE_RING_COLOR = 'rgba(255,90,90,.22)';
const BODY_STROKE = 'rgba(255,140,120,.6)';
const LASER_LENGTH = 30;
const LASER_COLOR = '#ffb13b';
const LASER_GLOW = '#ff8a1f';

export class PirateField {
  draw(drawing: Drawing, field: Model.PirateField, ship: Model.Ship, camera: Camera): void {
    const { width, height } = drawing.size;
    const visibleRange = Math.hypot(width, height) / camera.zoom * 0.7 + 100;
    const shipPosition = ship.position;
    const detectionRange = field.detectionRange(ship);
    const hunting = field.anyHunting();
    field.forEachPirate((pirate) => {
      if (length(sub(pirate.position, shipPosition)) > visibleRange) return;
      if (!pirate.isHunting) {
        drawing.arc(pirate.position, detectionRange, 0, Math.PI * 2, DETECTION_RING_COLOR, 1 / camera.zoom);
      }
      this.drawPirate(drawing, pirate, camera.zoom);
    });
    if (hunting) {
      drawing.arc(shipPosition, field.giveUpRadius(), 0, Math.PI * 2, ESCAPE_RING_COLOR, 1.5 / camera.zoom);
    }
    drawing.withAdditiveBlend(() => {
      field.forEachLaser((laser) => {
        const forward = { x: Math.cos(laser.angle), y: Math.sin(laser.angle) };
        const tail = scale(forward, -LASER_LENGTH);
        drawing.withShadow(LASER_GLOW, 12, () => {
          drawing.line({ x: laser.position.x + tail.x, y: laser.position.y + tail.y }, laser.position, LASER_COLOR, 3);
        });
      });
    });
  }

  private drawPirate(drawing: Drawing, pirate: Model.Pirate, zoom: number): void {
    drawing.withTransform(pirate.position, pirate.angle, () => {
      const r = pirate.radius;
      const hull: RadialPaint = {
        from: { x: r * 0.4, y: 0 }, fromRadius: 0,
        to: { x: 0, y: 0 }, toRadius: r * 1.3,
        stops: [
          { offset: 0, color: '#ffb0a0' },
          { offset: 0.5, color: '#c43a2a' },
          { offset: 1, color: '#5e1c14' },
        ],
      };
      const hullPoints = [
        { x: r * 1.15, y: 0 },
        { x: r * 0.35, y: r * 0.55 },
        { x: -r * 0.85, y: r * 0.5 },
        { x: -r * 1.0, y: r * 0.18 },
        { x: -r * 1.0, y: -r * 0.18 },
        { x: -r * 0.85, y: -r * 0.5 },
        { x: r * 0.35, y: -r * 0.55 },
      ];
      drawing.withShadow('#ff5a3a', 10, () => {
        drawing.polygon(hullPoints, hull, BODY_STROKE, 1.4 / zoom);
      });
      const wingPoints = [
        { x: r * 0.1, y: r * 0.35 },
        { x: -r * 0.5, y: r * 0.95 },
        { x: -r * 0.9, y: r * 0.7 },
        { x: -r * 0.55, y: r * 0.3 },
      ];
      drawing.polygon(wingPoints, '#7a2418', BODY_STROKE, 1.2 / zoom);
      const wingPointsLower = [
        { x: r * 0.1, y: -r * 0.35 },
        { x: -r * 0.5, y: -r * 0.95 },
        { x: -r * 0.9, y: -r * 0.7 },
        { x: -r * 0.55, y: -r * 0.3 },
      ];
      drawing.polygon(wingPointsLower, '#7a2418', BODY_STROKE, 1.2 / zoom);
      const cockpit: RadialPaint = {
        from: { x: r * 0.55, y: 0 }, fromRadius: 0,
        to: { x: r * 0.55, y: 0 }, toRadius: r * 0.35,
        stops: [
          { offset: 0, color: 'rgba(255,210,120,.9)' },
          { offset: 1, color: 'rgba(255,120,40,0)' },
        ],
      };
      drawing.circle({ x: r * 0.55, y: 0 }, r * 0.35, cockpit);
      drawing.line({ x: r * 1.15, y: 0 }, { x: r * 1.4, y: 0 }, BODY_STROKE, 1.8 / zoom);
    });
  }
}
