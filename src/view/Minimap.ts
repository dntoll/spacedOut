import * as Model from '../model';
import { clamp, normalize, sub } from '../math';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing, Size } from './Drawing';
import { ExplorationMap } from './ExplorationMap';

const DEFAULT_WORLD_SPAN = 8000;
const TRAVEL_WORLD_SPAN = 16000;

export class Minimap {
  static readonly worldSpan = DEFAULT_WORLD_SPAN;

  draw(
    drawing: Drawing,
    exploration: ExplorationMap,
    model: Model.Game,
    camera: Camera,
  ): void {
    const span = model.mission.isTraversal ? TRAVEL_WORLD_SPAN : DEFAULT_WORLD_SPAN;
    const compact = drawing.size.width <= 520;
    const mapSize = compact ? 128 : 180;
    const margin = compact ? 22 : clamp(drawing.size.width * 0.04, 20, 48);
    const position = { x: drawing.size.width - mapSize - margin, y: compact ? 56 : 72 };
    const size = { width: mapSize, height: mapSize };
    const center = camera.focusPosition;

    drawing.rectangle(
      { x: position.x - 1, y: position.y - 1 },
      { width: mapSize + 2, height: mapSize + 2 },
      'rgba(104,218,239,.32)',
    );
    drawing.rectangle(position, size, 'rgba(2,8,17,.84)');
    drawing.withClipRectangle(position, size, () => {
      this.drawExplored(drawing, exploration, center, position, size, span);
      this.drawMassiveAsteroids(drawing, exploration, model.massiveAsteroidField, center, position, size, span);
      this.drawAsteroids(drawing, exploration, model.asteroidBelt, center, position, size, span);
      this.drawSupplies(drawing, exploration, model.supplyField, center, position, size, span);
      this.drawDrones(drawing, exploration, model.droneField, center, position, size, span);
      this.drawPirates(drawing, exploration, model.pirateField, center, position, size, span);
      this.drawShip(drawing, model.ship.angle, position, size);
      this.drawSignal(drawing, model, position, size, center);
    });
  }

  private drawExplored(
    drawing: Drawing,
    exploration: ExplorationMap,
    center: Vec2,
    position: Vec2,
    size: Size,
    span: number,
  ): void {
    const cellPixels = ExplorationMap.cellSize / span * size.width;
    exploration.forEachVisibleCell(center, span, (cell) => {
      const point = this.toMap(cell, center, position, size, span);
      drawing.rectangle(point, { width: cellPixels + 0.35, height: cellPixels + 0.35 }, 'rgba(68,139,158,.22)');
    });
  }

  private drawMassiveAsteroids(
    drawing: Drawing,
    exploration: ExplorationMap,
    field: Model.MassiveAsteroidField,
    center: Vec2,
    position: Vec2,
    size: Size,
    span: number,
  ): void {
    field.forEachKnown((asteroid) => {
      if (!exploration.isCircleExplored(asteroid.position, asteroid.radius)) return;
      if (!this.intersectsMap(asteroid.position, asteroid.radius, center, span)) return;
      const point = this.toMap(asteroid.position, center, position, size, span);
      const radius = clamp(asteroid.radius / span * size.width, 3, size.width * 0.18);
      const scale = radius / asteroid.radius;
      const outline = asteroid.vertices.map((variation, index) => {
        const angle = index / asteroid.vertices.length * Math.PI * 2;
        return {
          x: Math.cos(angle) * asteroid.radius * variation * scale,
          y: Math.sin(angle) * asteroid.radius * variation * scale,
        };
      });
      drawing.withTransform(point, asteroid.angle, () => {
        drawing.polygon(outline, 'rgba(90,112,132,.74)', 'rgba(157,203,220,.82)', 1);
      });
    });
  }

  private drawAsteroids(
    drawing: Drawing,
    exploration: ExplorationMap,
    belt: Model.AsteroidBelt,
    center: Vec2,
    position: Vec2,
    size: Size,
    span: number,
  ): void {
    belt.forEach((asteroid) => {
      if (!exploration.isExplored(asteroid.position, asteroid.radius)) return;
      if (!this.intersectsMap(asteroid.position, asteroid.radius, center, span)) return;
      drawing.circle(
        this.toMap(asteroid.position, center, position, size, span),
        1.6,
        'rgba(146,164,186,.72)',
      );
    });
  }

  private drawSupplies(
    drawing: Drawing,
    exploration: ExplorationMap,
    field: Model.SupplyField,
    center: Vec2,
    position: Vec2,
    size: Size,
    span: number,
  ): void {
    field.forEachKnown((container) => {
      if (!exploration.isExplored(container.position) || !this.intersectsMap(container.position, 0, center, span)) return;
      drawing.circle(
        this.toMap(container.position, center, position, size, span),
        2.2,
        container instanceof Model.HpContainer
          ? '#5dff9a'
          : container instanceof Model.AmmoContainer
            ? '#c98bff'
            : '#ffc35c',
      );
    });
  }

  private drawDrones(
    drawing: Drawing,
    exploration: ExplorationMap,
    field: Model.DroneField,
    center: Vec2,
    position: Vec2,
    size: Size,
    span: number,
  ): void {
    field.forEach((drone) => {
      if (!exploration.isExplored(drone.position) || !this.intersectsMap(drone.position, 0, center, span)) return;
      drawing.circle(
        this.toMap(drone.position, center, position, size, span),
        2.0,
        '#5db8ff',
      );
    });
  }

  private drawPirates(
    drawing: Drawing,
    exploration: ExplorationMap,
    field: Model.PirateField,
    center: Vec2,
    position: Vec2,
    size: Size,
    span: number,
  ): void {
    field.forEachPirate((pirate) => {
      if (!exploration.isExplored(pirate.position) || !this.intersectsMap(pirate.position, 0, center, span)) return;
      drawing.circle(
        this.toMap(pirate.position, center, position, size, span),
        2.6,
        '#ff6a4a',
      );
    });
  }

  private drawShip(drawing: Drawing, angle: number, position: Vec2, size: Size): void {
    const center = { x: position.x + size.width / 2, y: position.y + size.height / 2 };
    drawing.withTransform(center, angle, () => {
      drawing.polygon(
        [{ x: 6, y: 0 }, { x: -4, y: -3.5 }, { x: -4, y: 3.5 }],
        '#e9fbff',
        '#61e7ff',
        1,
      );
    });
  }

  private drawSignal(drawing: Drawing, model: Model.Game, position: Vec2, size: Size, worldCenter: Vec2): void {
    const destination = model.mission.destinationPosition;
    let direction: Vec2 | null = null;
    if (destination) {
      const dir = normalize(sub(destination, worldCenter));
      if (dir.x !== 0 || dir.y !== 0) direction = dir;
    }
    if (!direction) direction = model.mission.signalDirection;
    if (!direction) return;
    const center = { x: position.x + size.width / 2, y: position.y + size.height / 2 };
    const edge = this.squareEdge(center, direction, position, size);
    drawing.dashedLine(center, edge, '#ff3b3b', 1.5);
    const inwardAngle = Math.atan2(-direction.y, -direction.x);
    const halfSpread = Math.PI / 2;
    const maxRadius = size.width / 2;
    const period = 1.4;
    const arcCount = 3;
    for (let index = 0; index < arcCount; index++) {
      const phase = ((model.elapsed / period) + index / arcCount) % 1;
      const radius = phase * maxRadius;
      if (radius < 1) continue;
      const alpha = (1 - phase) * 0.8;
      drawing.arc(edge, radius, inwardAngle - halfSpread, inwardAngle + halfSpread, `rgba(255,59,59,${alpha.toFixed(3)})`, 1);
    }
  }

  private squareEdge(center: Vec2, direction: Vec2, position: Vec2, size: Size): Vec2 {
    const half = { width: size.width / 2, height: size.height / 2 };
    const candidates: number[] = [];
    if (direction.x > 0) candidates.push(half.width / direction.x);
    else if (direction.x < 0) candidates.push(-half.width / direction.x);
    if (direction.y > 0) candidates.push(half.height / direction.y);
    else if (direction.y < 0) candidates.push(-half.height / direction.y);
    const t = Math.min(...candidates.filter((value) => value > 0));
    return { x: center.x + direction.x * t, y: center.y + direction.y * t };
  }

  private toMap(world: Vec2, center: Vec2, position: Vec2, size: Size, span: number): Vec2 {
    return {
      x: position.x + size.width / 2 + (world.x - center.x) / span * size.width,
      y: position.y + size.height / 2 + (world.y - center.y) / span * size.height,
    };
  }

  private intersectsMap(world: Vec2, radius: number, center: Vec2, span: number): boolean {
    const halfSpan = span / 2;
    return (
      world.x + radius >= center.x - halfSpan
      && world.x - radius <= center.x + halfSpan
      && world.y + radius >= center.y - halfSpan
      && world.y - radius <= center.y + halfSpan
    );
  }
}
