import * as Model from '../model';
import type { Drawing } from './Drawing';
import type { StarLight } from './StarLight';

const WALL_FILL = '#3a2418';
const WALL_STROKE = 'rgba(150,86,52,.5)';
const MACHINERY_FILL = '#241811';
const MACHINERY_STROKE = 'rgba(96,58,36,.6)';
const GATE_CLOSED_FILL = '#5a2a1a';
const GATE_CLOSED_STROKE = '#d98a4a';
const GATE_OPEN_STROKE = 'rgba(86,180,120,.5)';
const SWITCH_INACTIVE = '#5de0ff';
const SWITCH_ACTIVE = '#3a4a52';

export class StationMaze {
  draw(drawing: Drawing, maze: Model.StationMaze, starLight: StarLight, zoom: number): void {
    if (!maze.isPlaced) return;
    const lineWidth = Math.max(1, 2 / zoom);

    drawing.circle(maze.centralCenter!, maze.centralRadius, 'rgba(80,60,40,.18)');
    drawing.circle(maze.centralCenter!, maze.centralRadius * 0.92, 'rgba(120,86,52,.10)');

    maze.forEachWall((wall) => this.drawWall(drawing, wall));
    maze.forEachMachinery((m) => this.drawMachinery(drawing, m, lineWidth));
    maze.forEachGate((gate) => this.drawGate(drawing, gate, lineWidth));
    maze.forEachSwitch((sw) => this.drawSwitch(drawing, sw, zoom));
    maze.forEachCollectible((container) => this.drawCollectible(drawing, container));
  }

  private drawWall(drawing: Drawing, wall: Model.StationWall): void {
    const width = wall.wallRadius * 2;
    drawing.line(wall.a, wall.b, WALL_FILL, width);
    drawing.line(wall.a, wall.b, WALL_STROKE, Math.max(1, width * 0.12));
  }

  private drawMachinery(drawing: Drawing, machinery: Model.StationMachinery, lineWidth: number): void {
    drawing.withTransform(machinery.position, machinery.angle, () => {
      const r = machinery.radius;
      drawing.circle({ x: 0, y: 0 }, r, MACHINERY_FILL, MACHINERY_STROKE, lineWidth);
      drawing.circle({ x: -r * 0.3, y: 0 }, r * 0.5, MACHINERY_FILL, MACHINERY_STROKE, lineWidth);
      drawing.line({ x: -r, y: 0 }, { x: r, y: 0 }, MACHINERY_STROKE, lineWidth);
      drawing.line({ x: 0, y: -r }, { x: 0, y: r }, MACHINERY_STROKE, lineWidth);
    });
  }

  private drawGate(drawing: Drawing, gate: Model.StationGate, lineWidth: number): void {
    if (gate.open) {
      drawing.line(gate.a, gate.b, 'rgba(86,180,120,.25)', Math.max(1, lineWidth));
    } else {
      drawing.line(gate.a, gate.b, GATE_CLOSED_FILL, gate.wallRadius * 2);
      drawing.line(gate.a, gate.b, GATE_CLOSED_STROKE, Math.max(1, gate.wallRadius * 0.3));
    }
  }

  private drawSwitch(drawing: Drawing, sw: Model.StationSwitch, zoom: number): void {
    const color = sw.activated ? SWITCH_ACTIVE : SWITCH_INACTIVE;
    drawing.withShadow(color, sw.activated ? 6 : 16, () => {
      drawing.circle(sw.position, sw.radius, sw.activated ? 'rgba(58,74,82,.4)' : 'rgba(93,224,255,.22)', color, 2 / zoom);
    });
    drawing.withTransform(sw.position, 0, () => {
      drawing.line({ x: -sw.radius, y: 0 }, { x: sw.radius, y: 0 }, color, 2 / zoom);
      drawing.line({ x: 0, y: -sw.radius }, { x: 0, y: sw.radius }, color, 2 / zoom);
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
