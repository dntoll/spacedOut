import { length, sub } from '../math';
import type * as Model from '../model';
import type { Camera } from './Camera';
import type { Drawing, RadialPaint } from './Drawing';

const ARM_COLOR = '#9dff7a';
const BODY_STROKE = 'rgba(150,255,120,.55)';
const DETECTION_RING_COLOR = 'rgba(150,255,120,.28)';
const ESCAPE_RING_COLOR = 'rgba(150,255,120,.22)';

export class DroneField {
  draw(drawing: Drawing, field: Model.DroneField, ship: Model.Ship, camera: Camera): void {
    const { width, height } = drawing.size;
    const visibleRange = Math.hypot(width, height) / camera.zoom * 0.7 + 100;
    const shipPosition = ship.position;
    const detectionRange = field.detachRange(ship);
    const hunting = field.anyHunting();
    field.forEach((drone) => {
      if (length(sub(drone.position, shipPosition)) > visibleRange) return;
      if (!drone.isHunting) {
        drawing.arc(drone.position, detectionRange, 0, Math.PI * 2, DETECTION_RING_COLOR, 1 / camera.zoom);
      }
      this.drawDrone(drawing, drone, camera.zoom);
    });
    if (hunting) {
      drawing.arc(shipPosition, field.giveUpRadius(), 0, Math.PI * 2, ESCAPE_RING_COLOR, 1.5 / camera.zoom);
    }
  }

  private drawDrone(drawing: Drawing, drone: Model.Drone, zoom: number): void {
    drawing.withTransform(drone.position, drone.angle, () => {
      const points = drone.vertices.map((variation, index) => {
        const angle = (index / drone.vertices.length) * Math.PI * 2;
        const radius = drone.radius * variation;
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      });
      const body: RadialPaint = {
        from: { x: drone.radius * 0.3, y: 0 }, fromRadius: 0,
        to: { x: 0, y: 0 }, toRadius: drone.radius * 1.3,
        stops: [
          { offset: 0, color: '#b6ff8a' },
          { offset: 0.5, color: '#3fae3a' },
          { offset: 1, color: '#1c5e22' },
        ],
      };
      drawing.withShadow('#7dff5e', 10, () => {
        drawing.polygon(points, body, BODY_STROKE, 1.2 / zoom);
      });
      const armBase = drone.radius * 0.6;
      const armReach = drone.radius * 1.7;
      const armSpread = drone.radius * 0.9;
      const claw = drone.radius * 0.5;
      for (const side of [-1, 1]) {
        const start = { x: armBase, y: side * armSpread };
        const tip = { x: armReach, y: side * 0.2 * drone.radius };
        drawing.line(start, tip, ARM_COLOR, 1.6 / zoom);
        drawing.line(tip, { x: armReach - claw, y: side * (0.2 * drone.radius + claw) }, ARM_COLOR, 1.4 / zoom);
        drawing.line(tip, { x: armReach - claw, y: side * (0.2 * drone.radius - claw * 0.4) }, ARM_COLOR, 1.4 / zoom);
      }
    });
  }
}
