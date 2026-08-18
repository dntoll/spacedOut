import * as Model from '../model';
import type { Drawing } from './Drawing';
import type { StarLight, ShadowCasters } from './StarLight';

const WEAPON_POD_ANGLE = -Math.PI / 4;
const BLASTER: { x: number; y: number }[] = [
  { x: -15, y: -6 }, { x: 12, y: -6 }, { x: 14, y: -8 },
  { x: 18, y: -3 }, { x: 18, y: 3 }, { x: 14, y: 8 },
  { x: 12, y: 6 }, { x: -4, y: 6 }, { x: -4, y: 14 },
  { x: -11, y: 14 }, { x: -11, y: 6 }, { x: -15, y: 6 },
];

export class SupplyField {
  draw(drawing: Drawing, field: Model.SupplyField, starLight: StarLight, casters: ShadowCasters | null): void {
    field.forEachActive((container) => {
      if (container instanceof Model.WeaponPod) {
        this.drawWeaponPod(drawing, container, starLight, casters);
        return;
      }
      const isHp = container instanceof Model.HpContainer;
      const isAmmo = container instanceof Model.AmmoContainer;
      const color = isHp ? '#7dffb0' : isAmmo ? '#c98bff' : '#ffc35c';
      const dark = isHp ? '#0f3d24' : isAmmo ? '#2a1a3d' : '#3d2a0f';
      const shadow = starLight.shadowFactor(container.position, container.radius, casters);
      const body = starLight.bodyPaint(starLight.localDirection(0), container.radius, color, dark, shadow);
      drawing.withShadow(color, 12, () => {
        drawing.withTransform(container.position, 0, () => {
          drawing.circle({ x: 0, y: 0 }, container.radius, body, color, 1.5);
          drawing.circle({ x: 0, y: 0 }, 4, color);
        });
      });
    });
  }

  private drawWeaponPod(drawing: Drawing, pod: Model.WeaponPod, starLight: StarLight, casters: ShadowCasters | null): void {
    const color = '#7ee9ff';
    drawing.withShadow(color, 14, () => {
      drawing.circle(pod.position, pod.radius, 'rgba(126,233,255,.18)', color, 1.5);
    });
    const shadow = starLight.shadowFactor(pod.position, pod.radius, casters);
    const body = starLight.bodyPaint(starLight.localDirection(WEAPON_POD_ANGLE), pod.radius, '#2c5d7a', '#06121c', shadow);
    drawing.withTransform(pod.position, WEAPON_POD_ANGLE, () => {
      drawing.polygon(BLASTER, body, color, 1.8);
      drawing.circle({ x: 18, y: 0 }, 4, color);
      drawing.circle({ x: -3, y: 0 }, 2.5, '#9ff6ff');
      drawing.line({ x: -15, y: 0 }, { x: 12, y: 0 }, '#2c5d7a', 1);
    });
  }
}
