import * as Model from '../model';
import type { Drawing } from './Drawing';

export class SupplyField {
  draw(drawing: Drawing, field: Model.SupplyField): void {
    field.forEachActive((container) => {
      const isHp = container instanceof Model.HpContainer;
      const isAmmo = container instanceof Model.AmmoContainer;
      const color = isHp ? '#7dffb0' : isAmmo ? '#c98bff' : '#ffc35c';
      const glow = isHp ? 'rgba(90,255,150,.18)' : isAmmo ? 'rgba(190,130,255,.18)' : 'rgba(255,174,54,.18)';
      drawing.withShadow(color, 12, () => {
        drawing.circle(container.position, container.radius, glow, color, 1.5);
        drawing.circle(container.position, 4, color);
      });
    });
  }
}
