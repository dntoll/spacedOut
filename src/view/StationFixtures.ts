import * as Model from '../model';
import type { Vec2 } from '../types';
import type { Drawing } from './Drawing';
import type { StarLight } from './StarLight';

const GATE_CLOSED_BASE = '#3a1c10';
const GATE_HAZARD = '#e8923a';
const GATE_HAZARD_DARK = '#1a0c06';
const GATE_OPEN = 'rgba(86,200,140,.35)';
const SWITCH_INACTIVE = '#5de0ff';
const SWITCH_ACTIVE = '#3a5a52';
const SWITCH_ACTIVE_GLOW = '#5dff9a';
const MACHINERY_BODY = '#2a1c12';
const MACHINERY_CAP = '#4a3422';
const MACHINERY_PIPE = 'rgba(120,78,46,.6)';
const MACHINERY_HIGHLIGHT = '#6a4630';
const SHIELD_POD_COLOR = '#4d9fff';
const SHIELD_POD_DARK = '#0e2a52';
const SHIELD_POD_RIM = '#9fc4ff';
const SHIELD_ICON: { x: number; y: number }[] = [
  { x: -10, y: -12 }, { x: 10, y: -12 },
  { x: 10, y: -2 }, { x: 0, y: 14 }, { x: -10, y: -2 },
];

export class StationFixtures {
  // Drawn before the lamp darkness composite so unlit doors are hidden until
  // the lamp reaches them.
  drawDarkened(drawing: Drawing, station: Model.Station, starLight: StarLight, zoom: number): void {
    if (!station.isPlaced) return;
    const lineWidth = Math.max(1, 2 / zoom);
    station.forEachGate((gate) => this.drawGate(drawing, gate, zoom));
    void lineWidth;
  }

  // Drawn after the lamp composite: switches and supply containers carry their
  // own glow; machinery is lit by the lamp's radial gradient (same falloff as
  // the floor) so it fades in/out smoothly without popping. It still casts
  // shadows via the lamp raycaster.
  drawGlowing(drawing: Drawing, station: Model.Station, starLight: StarLight, zoom: number, shipPosition?: Vec2, lampRadius?: number): void {
    if (!station.isPlaced) return;
    const lineWidth = Math.max(1, 2 / zoom);
    station.forEachMachinery((m) => {
      const light = shipPosition && lampRadius && lampRadius > 0
        ? lampLightAt(Math.hypot(m.position.x - shipPosition.x, m.position.y - shipPosition.y), lampRadius)
        : 0;
      if (light <= 0) return;
      this.drawMachinery(drawing, m, lineWidth, light);
    });
    station.forEachSwitch((sw) => this.drawSwitch(drawing, sw, zoom));
    station.forEachCollectible((container) => this.drawCollectible(drawing, container));
  }

  draw(drawing: Drawing, station: Model.Station, starLight: StarLight, zoom: number): void {
    this.drawDarkened(drawing, station, starLight, zoom);
    this.drawGlowing(drawing, station, starLight, zoom);
  }

  private drawGate(drawing: Drawing, gate: Model.StationGate, zoom: number): void {
    const hl = gate.halfLength;
    const hw = gate.halfWidth;
    drawing.withTransform(gate.position, gate.angle, () => {
      if (gate.open) {
        drawing.line({ x: -hl, y: 0 }, { x: hl, y: 0 }, GATE_OPEN, Math.max(1, 2 / zoom));
        return;
      }
      drawing.polygon(
        [{ x: hl, y: -hw }, { x: hl, y: hw }, { x: -hl, y: hw }, { x: -hl, y: -hw }],
        GATE_CLOSED_BASE,
      );
      drawing.dashedLine({ x: -hl, y: -hw }, { x: hl, y: -hw }, GATE_HAZARD, Math.max(1.5, hw * 0.7), [hw * 1.8, hw * 1.2]);
      drawing.dashedLine({ x: -hl, y: hw }, { x: hl, y: hw }, GATE_HAZARD, Math.max(1.5, hw * 0.7), [hw * 1.8, hw * 1.2]);
      drawing.dashedLine({ x: -hl, y: 0 }, { x: hl, y: 0 }, GATE_HAZARD_DARK, Math.max(1, hw * 0.4), [hw * 0.6, hw * 2.4]);
    });
  }

  private drawSwitch(drawing: Drawing, sw: Model.StationSwitch, zoom: number): void {
    const color = sw.activated ? SWITCH_ACTIVE_GLOW : SWITCH_INACTIVE;
    drawing.withShadow(color, sw.activated ? 8 : 16, () => {
      drawing.circle(sw.position, sw.radius, sw.activated ? 'rgba(60,90,82,.4)' : 'rgba(93,224,255,.20)', color, 2 / zoom);
    });
    drawing.withTransform(sw.position, 0, () => {
      const r = sw.radius;
      drawing.polygon(
        [{ x: r * 0.7, y: -r * 0.4 }, { x: r * 0.7, y: r * 0.4 }, { x: -r * 0.4, y: r * 0.4 }, { x: -r * 0.4, y: -r * 0.4 }],
        sw.activated ? 'rgba(60,90,82,.5)' : 'rgba(20,40,52,.5)',
        color,
        1.5 / zoom,
      );
      drawing.line({ x: -r * 0.4, y: 0 }, { x: -r, y: 0 }, color, 2 / zoom);
    });
  }

  private drawMachinery(drawing: Drawing, machinery: Model.StationMachinery, lineWidth: number, light = 1): void {
    drawing.withTransform(machinery.position, machinery.angle, () => {
      const r = machinery.radius;
      const halfLen = r;
      const halfWid = r * 0.72;
      const rect = [{ x: halfLen, y: -halfWid }, { x: halfLen, y: halfWid }, { x: -halfLen, y: halfWid }, { x: -halfLen, y: -halfWid }];
      drawing.polygon(rect, MACHINERY_BODY, MACHINERY_CAP, lineWidth);
      if (machinery.variant % 2 === 0) {
        drawing.circle({ x: halfLen * 0.4, y: 0 }, halfWid * 0.6, MACHINERY_CAP, MACHINERY_HIGHLIGHT, lineWidth);
        drawing.circle({ x: -halfLen * 0.4, y: 0 }, halfWid * 0.6, MACHINERY_CAP, MACHINERY_HIGHLIGHT, lineWidth);
      } else {
        drawing.line({ x: -halfLen, y: -halfWid }, { x: halfLen, y: halfWid }, MACHINERY_PIPE, lineWidth);
        drawing.line({ x: -halfLen, y: halfWid }, { x: halfLen, y: -halfWid }, MACHINERY_PIPE, lineWidth);
        drawing.circle({ x: 0, y: 0 }, halfWid * 0.5, MACHINERY_HIGHLIGHT, MACHINERY_CAP, lineWidth);
      }
      // Darken the machinery by the inverse of the lamp light at this distance,
      // matching the radial gradient the floor receives via the multiply composite.
      if (light < 1) drawing.polygon(rect, `rgba(0,0,0,${(1 - light).toFixed(3)})`);
    });
  }

  private drawCollectible(drawing: Drawing, container: Model.SupplyContainer): void {
    if (container instanceof Model.ShieldPod) {
      this.drawShieldPod(drawing, container);
      return;
    }
    const isHp = container instanceof Model.HpContainer;
    const isAmmo = container instanceof Model.AmmoContainer;
    const color = isHp ? '#7dffb0' : isAmmo ? '#c98bff' : '#ffc35c';
    drawing.withShadow(color, 12, () => {
      drawing.circle(container.position, container.radius, 'rgba(255,255,255,.10)', color, 1.5);
    });
    drawing.circle(container.position, 4, color);
  }

  private drawShieldPod(drawing: Drawing, pod: Model.ShieldPod): void {
    drawing.withShadow(SHIELD_POD_COLOR, 14, () => {
      drawing.circle(pod.position, pod.radius, 'rgba(77,159,255,.18)', SHIELD_POD_COLOR, 1.5);
    });
    drawing.withTransform(pod.position, 0, () => {
      drawing.polygon(SHIELD_ICON, SHIELD_POD_DARK, SHIELD_POD_COLOR, 1.8);
      drawing.line({ x: 0, y: -8 }, { x: 0, y: 9 }, SHIELD_POD_RIM, 1);
      drawing.line({ x: -6, y: -3 }, { x: 6, y: -3 }, SHIELD_POD_RIM, 1);
    });
  }
}

// The lamp's radial gradient value at a normalized distance t = dist/radius.
// Matches the stops in StationLamp so machinery gets the same light as the floor.
const lampLightAt = (dist: number, radius: number): number => {
  const t = dist / radius;
  if (t >= 1) return 0;
  if (t <= 0.35) return 1 - (1 - 0.98) * (t / 0.35);
  if (t <= 0.7) return 0.98 + (0.5 - 0.98) * ((t - 0.35) / (0.7 - 0.35));
  return 0.5 + (0 - 0.5) * ((t - 0.7) / (1 - 0.7));
};
