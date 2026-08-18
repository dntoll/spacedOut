import * as Model from '../model';
import type { Drawing } from './Drawing';

const WEAPON_POD_ANGLE = -Math.PI / 4;
const BLASTER: { x: number; y: number }[] = [
  { x: -15, y: -6 }, { x: 12, y: -6 }, { x: 14, y: -8 },
  { x: 18, y: -3 }, { x: 18, y: 3 }, { x: 14, y: 8 },
  { x: 12, y: 6 }, { x: -4, y: 6 }, { x: -4, y: 14 },
  { x: -11, y: 14 }, { x: -11, y: 6 }, { x: -15, y: 6 },
];

export class SupplyField {
  draw(drawing: Drawing, field: Model.SupplyField): void {
    field.forEachActive((container) => {
      if (container instanceof Model.WeaponPod) {
        this.drawWeaponPod(drawing, container);
        return;
      }
      const isHp = container instanceof Model.HpContainer;
      const isAmmo = container instanceof Model.AmmoContainer;
      const color = isHp ? '#7dffb0' : isAmmo ? '#c98bff' : '#ffc35c';
      const glow = isHp
        ? 'rgba(90,255,150,.18)'
        : isAmmo
          ? 'rgba(190,130,255,.18)'
          : 'rgba(255,174,54,.18)';
      drawing.withShadow(color, 12, () => {
        drawing.circle(container.position, container.radius, glow, color, 1.5);
        drawing.circle(container.position, 4, color);
      });
    });
  }

  private drawWeaponPod(drawing: Drawing, pod: Model.WeaponPod): void {
    const color = '#7ee9ff';
    drawing.withShadow(color, 14, () => {
      drawing.circle(pod.position, pod.radius, 'rgba(126,233,255,.18)', color, 1.5);
    });
    drawing.withTransform(pod.position, WEAPON_POD_ANGLE, () => {
      drawing.polygon(BLASTER, '#13314a', color, 1.8);
      drawing.circle({ x: 18, y: 0 }, 4, color);
      drawing.circle({ x: -3, y: 0 }, 2.5, '#9ff6ff');
      drawing.line({ x: -15, y: 0 }, { x: 12, y: 0 }, '#2c5d7a', 1);
    });
  }
}
