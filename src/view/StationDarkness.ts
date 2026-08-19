import * as Model from '../model';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing } from './Drawing';
import { StationVisibility, type VisibilitySegment } from '../model/StationVisibility';
import { isCapsuleObstacle } from '../model/SweptCircleCollision';
import { length, sub } from '../math';

const CONE_HALF = Math.PI * 0.30;
const DARKNESS_ALPHA = 0.9;
const WALL_LIT_FILL = '#5a3a22';
const WALL_LIT_STROKE = 'rgba(180,110,68,.6)';

export class StationDarkness {
  draw(drawing: Drawing, maze: Model.StationMaze, ship: Model.Ship, camera: Camera, exploration: import('./ExplorationMap').ExplorationMap): void {
    if (!maze.isPlaced) return;
    if (length(sub(ship.position, maze.center!)) > maze.outerRadius) return;

    const bounds = camera.getVisibleWorldBounds(drawing.size);
    const range = camera.getVisibleWorldRadius(drawing.size) * 1.1;

    const segments = this.collectSegments(maze, ship.position, range);
    const polygon = StationVisibility.compute(ship.position, ship.angle, CONE_HALF, range, segments);
    exploration.observeLineOfSight(polygon);

    drawing.rectangle(
      { x: bounds.left, y: bounds.top },
      { width: bounds.right - bounds.left, height: bounds.bottom - bounds.top },
      `rgba(2,6,14,${DARKNESS_ALPHA})`,
    );

    drawing.withClipPath(polygon, () => {
      this.drawLitWalls(drawing, maze, ship.position, range);
      this.drawLightGlow(drawing, ship.position, range);
    });
  }

  private collectSegments(maze: Model.StationMaze, origin: Vec2, range: number): VisibilitySegment[] {
    const segments: VisibilitySegment[] = [];
    const rangeSq = range * range;
    maze.forEachWall((wall) => {
      if (!isCapsuleObstacle(wall)) return;
      const midX = (wall.a.x + wall.b.x) / 2;
      const midY = (wall.a.y + wall.b.y) / 2;
      const dx = midX - origin.x;
      const dy = midY - origin.y;
      if (dx * dx + dy * dy > rangeSq * 1.3) return;
      segments.push({ a: wall.a, b: wall.b });
    });
    maze.forEachGate((gate) => {
      if (gate.open) return;
      if (!isCapsuleObstacle(gate)) return;
      const midX = (gate.a.x + gate.b.x) / 2;
      const midY = (gate.a.y + gate.b.y) / 2;
      const dx = midX - origin.x;
      const dy = midY - origin.y;
      if (dx * dx + dy * dy > rangeSq * 1.3) return;
      segments.push({ a: gate.a, b: gate.b });
    });
    return segments;
  }

  private drawLitWalls(drawing: Drawing, maze: Model.StationMaze, origin: Vec2, range: number): void {
    const rangeSq = range * range;
    maze.forEachWall((wall) => {
      if (!isCapsuleObstacle(wall)) return;
      const midX = (wall.a.x + wall.b.x) / 2;
      const midY = (wall.a.y + wall.b.y) / 2;
      const dx = midX - origin.x;
      const dy = midY - origin.y;
      if (dx * dx + dy * dy > rangeSq) return;
      drawing.line(wall.a, wall.b, WALL_LIT_FILL, wall.wallRadius * 2);
      drawing.line(wall.a, wall.b, WALL_LIT_STROKE, Math.max(1, wall.wallRadius * 0.3));
    });
    maze.forEachGate((gate) => {
      if (gate.open) return;
      if (!isCapsuleObstacle(gate)) return;
      drawing.line(gate.a, gate.b, '#d98a4a', gate.wallRadius * 2);
    });
    maze.forEachSwitch((sw) => {
      drawing.circle(sw.position, sw.radius, sw.activated ? 'rgba(58,74,82,.4)' : 'rgba(93,224,255,.22)', sw.activated ? '#3a4a52' : '#5de0ff', 2);
    });
    maze.forEachCollectible((container) => {
      const isHp = container instanceof Model.HpContainer;
      const isAmmo = container instanceof Model.AmmoContainer;
      const color = isHp ? '#7dffb0' : isAmmo ? '#c98bff' : '#ffc35c';
      drawing.circle(container.position, container.radius, 'rgba(255,255,255,.10)', color, 1.5);
    });
  }

  private drawLightGlow(drawing: Drawing, origin: Vec2, range: number): void {
    drawing.circle(origin, range * 0.15, {
      from: origin,
      fromRadius: 0,
      to: origin,
      toRadius: range * 0.15,
      stops: [
        { offset: 0, color: 'rgba(255,240,200,.18)' },
        { offset: 1, color: 'rgba(255,240,200,0)' },
      ],
    });
  }
}
