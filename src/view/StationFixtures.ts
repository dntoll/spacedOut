import * as Model from '../model';
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

export class StationFixtures {
  draw(drawing: Drawing, station: Model.Station, starLight: StarLight, zoom: number): void {
    if (!station.isPlaced) return;
    const lineWidth = Math.max(1, 2 / zoom);

    station.forEachMachinery((m) => this.drawMachinery(drawing, m, lineWidth));
    station.forEachGate((gate) => this.drawGate(drawing, gate, zoom));
    station.forEachSwitch((sw) => this.drawSwitch(drawing, sw, zoom));
    station.forEachCollectible((container) => this.drawCollectible(drawing, container));
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

  private drawMachinery(drawing: Drawing, machinery: Model.StationMachinery, lineWidth: number): void {
    drawing.withTransform(machinery.position, machinery.angle, () => {
      const r = machinery.radius;
      const halfLen = r;
      const halfWid = r * 0.72;
      drawing.polygon(
        [{ x: halfLen, y: -halfWid }, { x: halfLen, y: halfWid }, { x: -halfLen, y: halfWid }, { x: -halfLen, y: -halfWid }],
        MACHINERY_BODY,
        MACHINERY_CAP,
        lineWidth,
      );
      if (machinery.variant % 2 === 0) {
        drawing.circle({ x: halfLen * 0.4, y: 0 }, halfWid * 0.6, MACHINERY_CAP, MACHINERY_HIGHLIGHT, lineWidth);
        drawing.circle({ x: -halfLen * 0.4, y: 0 }, halfWid * 0.6, MACHINERY_CAP, MACHINERY_HIGHLIGHT, lineWidth);
      } else {
        drawing.line({ x: -halfLen, y: -halfWid }, { x: halfLen, y: halfWid }, MACHINERY_PIPE, lineWidth);
        drawing.line({ x: -halfLen, y: halfWid }, { x: halfLen, y: -halfWid }, MACHINERY_PIPE, lineWidth);
        drawing.circle({ x: 0, y: 0 }, halfWid * 0.5, MACHINERY_HIGHLIGHT, MACHINERY_CAP, lineWidth);
      }
    });
  }

  private drawCollectible(drawing: Drawing, container: Model.SupplyContainer): void {
    const isHp = container instanceof Model.HpContainer;
    const isAmmo = container instanceof Model.AmmoContainer;
    const color = isHp ? '#7dffb0' : isAmmo ? '#c98bff' : '#ffc35c';
    drawing.withShadow(color, 12, () => {
      drawing.circle(container.position, container.radius, 'rgba(255,255,255,.10)', color, 1.5);
    });
    drawing.circle(container.position, 4, color);
  }
}
