import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing, RadialPaint } from './Drawing';
import type { StarLight, ShadowCasters } from './StarLight';

interface Nozzle { offset: { x: number; y: number }; radius: number }

const TAIL: Nozzle = { offset: { x: -15, y: 0 }, radius: 35 };
const NOSE: Nozzle = { offset: { x: 20, y: 0 }, radius: 22 };
const STARBOARD: Nozzle = { offset: { x: -4, y: 13 }, radius: 18 };
const PORT: Nozzle = { offset: { x: -4, y: -13 }, radius: 18 };
const SHIP_SHADOW_RADIUS = 20;
const INVULNERABILITY_RADIUS = 30;
const HULL: readonly Vec2[] = [{ x: 22, y: 0 }, { x: -14, y: 13 }, { x: -14, y: -13 }];
const HULL_CENTER: Vec2 = { x: -2, y: 0 };
const SHIELD_MARGIN = 7;
const SHIELD_FLARE_TIME = 0.35;

export class Ship {
  draw(drawing: Drawing, ship: Model.Ship, starLight: StarLight, casters: ShadowCasters | null): void {
    drawing.withTransform(ship.position, ship.angle, () => {
      this.drawNozzles(drawing, ship);
      const localLight = starLight.localDirection(ship.angle, ship.position);
      const shadow = starLight.shadowFactor(ship.position, SHIP_SHADOW_RADIUS, casters);
      const hull = starLight.bodyPaint(localLight, 22, '#d9f7ff', '#16263b', shadow);
      drawing.withShadow('#7ee9ff', 15, () => {
        drawing.polygon([...HULL], hull, '#72dff5', 1.4);
      });
      drawing.polygon([{ x: 10, y: 0 }, { x: -6, y: 5 }, { x: -4, y: -5 }], '#182c45');
      this.drawWingGuns(drawing, ship);
      if (ship.shield > 0) this.drawShieldField(drawing, ship);
      if (ship.isInvulnerable) this.drawInvulnerabilityShield(drawing);
    });
  }

  private drawShieldField(drawing: Drawing, ship: Model.Ship): void {
    const flare = Math.max(0, 1 - ship.shieldHitAge / SHIELD_FLARE_TIME);
    const intensity = Math.min(1, ship.shieldFraction * 0.6 + flare);
    const reach = 26 + flare * 6;
    const field: RadialPaint = {
      from: { ...HULL_CENTER }, fromRadius: reach * 0.45,
      to: { ...HULL_CENTER }, toRadius: reach,
      stops: [
        { offset: 0, color: 'rgba(126,233,255,0)' },
        { offset: 0.6, color: `rgba(126,233,255,${(0.05 + intensity * 0.12).toFixed(3)})` },
        { offset: 1, color: `rgba(170,245,255,${(0.22 + intensity * 0.5).toFixed(3)})` },
      ],
    };
    drawing.withShadow('#7ee9ff', 10 + intensity * 18, () => {
      drawing.polygon(
        this.shieldOutline(SHIELD_MARGIN + flare * 3),
        field,
        `rgba(190,250,255,${(0.35 + intensity * 0.6).toFixed(3)})`,
        1.2 + intensity * 1.6,
      );
    });
  }

  private shieldOutline(margin: number): Vec2[] {
    return HULL.map((vertex) => {
      const dx = vertex.x - HULL_CENTER.x;
      const dy = vertex.y - HULL_CENTER.y;
      const distance = Math.hypot(dx, dy) || 1;
      return { x: vertex.x + (dx / distance) * margin, y: vertex.y + (dy / distance) * margin };
    });
  }

  private drawInvulnerabilityShield(drawing: Drawing): void {
    const shield: RadialPaint = {
      from: { x: 0, y: 0 }, fromRadius: INVULNERABILITY_RADIUS * 0.6,
      to: { x: 0, y: 0 }, toRadius: INVULNERABILITY_RADIUS,
      stops: [
        { offset: 0, color: 'rgba(126,233,255,0)' },
        { offset: 0.7, color: 'rgba(126,233,255,0.15)' },
        { offset: 1, color: 'rgba(126,233,255,0.4)' },
      ],
    };
    drawing.withShadow('#7ee9ff', 12, () => {
      drawing.circle({ x: 0, y: 0 }, INVULNERABILITY_RADIUS, shield, '#7ee9ff', 1.5);
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

    if (tailPower > 0.001) this.drawGlow(drawing, TAIL, Math.min(1, tailPower), ship.freeThrust);
    if (nosePower > 0.001) this.drawGlow(drawing, NOSE, nosePower, ship.freeThrust);
    if (starboardPower > 0.001) this.drawGlow(drawing, STARBOARD, starboardPower, ship.freeThrust);
    if (portPower > 0.001) this.drawGlow(drawing, PORT, portPower, ship.freeThrust);
  }

  private drawGlow(drawing: Drawing, nozzle: Nozzle, power: number, free: boolean): void {
    const core = free ? `rgba(230,215,175,${0.25 + power * 0.5})` : `rgba(255,195,92,${0.25 + power * 0.5})`;
    const edge = free ? 'rgba(200,200,175,0)' : 'rgba(255,140,40,0)';
    const glow: RadialPaint = {
      from: { ...nozzle.offset }, fromRadius: 0,
      to: { ...nozzle.offset }, toRadius: nozzle.radius,
      stops: [
        { offset: 0, color: core },
        { offset: 1, color: edge },
      ],
    };
    drawing.circle(nozzle.offset, nozzle.radius, glow);
  }
}
