import * as Model from '../model';
import type { Drawing } from './Drawing';

export class SupplyField {
  draw(drawing: Drawing, field: Model.SupplyField): void {
    field.forEachActive((container) => {
      const isAir = container instanceof Model.AirContainer;
      const color = isAir ? '#6eeeff' : '#ffc35c';
      const glow = isAir ? 'rgba(75,220,255,.18)' : 'rgba(255,174,54,.18)';
      drawing.withShadow(color, 12, () => {
        drawing.circle(container.position, container.radius, glow, color, 1.5);
        drawing.circle(container.position, 4, color);
      });
    });
  }
}
