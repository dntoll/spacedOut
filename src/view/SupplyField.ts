import * as Model from '../model';
import type { Drawing } from './Drawing';

export class SupplyField {
  draw(drawing: Drawing, field: Model.SupplyField): void {
    field.forEachActive((container) => {
      const isAir = container instanceof Model.AirContainer;
      const isHp = container instanceof Model.HpContainer;
      const color = isAir ? '#6eeeff' : isHp ? '#7dffb0' : '#ffc35c';
      const glow = isAir ? 'rgba(75,220,255,.18)' : isHp ? 'rgba(90,255,150,.18)' : 'rgba(255,174,54,.18)';
      drawing.withShadow(color, 12, () => {
        drawing.circle(container.position, container.radius, glow, color, 1.5);
        drawing.circle(container.position, 4, color);
      });
    });
  }
}
