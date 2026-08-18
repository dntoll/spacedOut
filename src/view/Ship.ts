import type * as Model from '../model';
import type { Drawing, RadialPaint } from './Drawing';
import type { StarLight, ShadowCasters } from './StarLight';

interface Nozzle { offset: { x: number; y: number }; radius: number }

const TAIL: Nozzle = { offset: { x: -15, y: 0 }, radius: 35 };
const NOSE: Nozzle = { offset: { x: 20, y: 0 }, radius: 22 };
const STARBOARD: Nozzle = { offset: { x: -4, y: 13 }, radius: 18 };
const PORT: Nozzle = { offset: { x: -4, y: -13 }, radius: 18 };
const SHIP_SHADOW_RADIUS = 20;

export class Ship {
  draw(drawing: Drawing, ship: Model.Ship, starLight: StarLight, casters: ShadowCasters | null): void {
    drawing.withTransform(ship.position, ship.angle, () => {
      this.drawNozzles(drawing, ship);
      const localLight = starLight.localDirection(ship.angle);
      const shadow = starLight.shadowFactor(ship.position, SHIP_SHADOW_RADIUS, casters);
      const hull = starLight.bodyPaint(localLight, 22, '#d9f7ff', '#16263b', shadow);
      drawing.withShadow('#7ee9ff', 15, () => {
        drawing.polygon(
          [{ x: 22, y: 0 }, { x: -14, y: 13 }, { x: -14, y: -13 }],
          hull,
          '#72dff5',
          1.4,
        );
      });
      drawing.polygon([{ x: 10, y: 0 }, { x: -6, y: 5 }, { x: -4, y: -5 }], '#182c45');
      this.drawWingGuns(drawing, ship);
    });
  }

  private drawWingGuns(drawing: Drawing, ship: Model.Ship): void {
    if (ship.weaponLevel >= 1) this.drawWingGun(drawing, -13);
    if (ship.weaponLevel >= 2) this.drawWingGun(drawing, 13);
  }

  private drawWingGun(drawing: Drawing, y: number): void {
    drawing.polygon(
      [{ x: 2, y }, { x: 14, y }, { x: 14, y: y > 0 ? 10 : -10 }, { x: 2, y: y > 0 ? 10 : -10 }],
      '#d9f7ff',
      '#72dff5',
      1.2,
    );
  }

  private drawNozzles(drawing: Drawing, ship: Model.Ship): void {
    const dir = ship.directionalThrust;
    const dirVec = dir?.vec ?? { x: 0, y: 0 };
    const level = dir?.level ?? 0;
    const tailPower = ship.pointerThrust + Math.max(0, dirVec.x) * level;
    const nosePower = Math.max(0, -dirVec.x) * level;
    const portPower = Math.max(0, dirVec.y) * level;
    const starboardPower = Math.max(0, -dirVec.y) * level;

    if (tailPower > 0.001) this.drawGlow(drawing, TAIL, Math.min(1, tailPower));
    if (nosePower > 0.001) this.drawGlow(drawing, NOSE, nosePower);
    if (starboardPower > 0.001) this.drawGlow(drawing, STARBOARD, starboardPower);
    if (portPower > 0.001) this.drawGlow(drawing, PORT, portPower);
  }

  private drawGlow(drawing: Drawing, nozzle: Nozzle, power: number): void {
    const glow: RadialPaint = {
      from: { ...nozzle.offset }, fromRadius: 0,
      to: { ...nozzle.offset }, toRadius: nozzle.radius,
      stops: [
        { offset: 0, color: `rgba(255,195,92,${0.25 + power * 0.5})` },
        { offset: 1, color: 'rgba(255,140,40,0)' },
      ],
    };
    drawing.circle(nozzle.offset, nozzle.radius, glow);
  }
}
