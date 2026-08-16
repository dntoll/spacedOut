import * as Model from '../model';
import { clamp } from '../math';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing, Size } from './Drawing';
import { ExplorationMap } from './ExplorationMap';

export class Minimap {
  static readonly worldSpan = 8000;

  draw(
    drawing: Drawing,
    exploration: ExplorationMap,
    model: Model.Game,
    camera: Camera,
  ): void {
    const compact = drawing.size.width <= 520;
    const mapSize = compact ? 128 : 180;
    const margin = compact ? 22 : clamp(drawing.size.width * 0.04, 20, 48);
    const position = { x: drawing.size.width - mapSize - margin, y: compact ? 56 : 72 };
    const size = { width: mapSize, height: mapSize };
    const center = camera.worldPosition;

    drawing.rectangle(
      { x: position.x - 1, y: position.y - 1 },
      { width: mapSize + 2, height: mapSize + 2 },
      'rgba(104,218,239,.32)',
    );
    drawing.rectangle(position, size, 'rgba(2,8,17,.84)');
    drawing.withClipRectangle(position, size, () => {
      this.drawExplored(drawing, exploration, center, position, size);
      this.drawMassiveAsteroids(drawing, exploration, model.massiveAsteroidField, center, position, size);
      this.drawSupplies(drawing, exploration, model.supplyField, center, position, size);
      this.drawShip(drawing, model.ship.angle, position, size);
    });
  }

  private drawExplored(
    drawing: Drawing,
    exploration: ExplorationMap,
    center: Vec2,
    position: Vec2,
    size: Size,
  ): void {
    const cellPixels = ExplorationMap.cellSize / Minimap.worldSpan * size.width;
    exploration.forEachVisibleCell(center, Minimap.worldSpan, (cell) => {
      const point = this.toMap(cell, center, position, size);
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
  ): void {
    field.forEachKnown((asteroid) => {
      if (!exploration.isExplored(asteroid.position, asteroid.radius)) return;
      if (!this.intersectsMap(asteroid.position, asteroid.radius, center)) return;
      const point = this.toMap(asteroid.position, center, position, size);
      const radius = clamp(asteroid.radius / Minimap.worldSpan * size.width, 3, size.width * 0.18);
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

  private drawSupplies(
    drawing: Drawing,
    exploration: ExplorationMap,
    field: Model.SupplyField,
    center: Vec2,
    position: Vec2,
    size: Size,
  ): void {
    field.forEachKnown((container) => {
      if (!exploration.isExplored(container.position) || !this.intersectsMap(container.position, 0, center)) return;
      drawing.circle(
        this.toMap(container.position, center, position, size),
        2.2,
        container instanceof Model.AirContainer ? '#62e6ff' : '#ffc35c',
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

  private toMap(world: Vec2, center: Vec2, position: Vec2, size: Size): Vec2 {
    return {
      x: position.x + size.width / 2 + (world.x - center.x) / Minimap.worldSpan * size.width,
      y: position.y + size.height / 2 + (world.y - center.y) / Minimap.worldSpan * size.height,
    };
  }

  private intersectsMap(world: Vec2, radius: number, center: Vec2): boolean {
    const halfSpan = Minimap.worldSpan / 2;
    return (
      world.x + radius >= center.x - halfSpan
      && world.x - radius <= center.x + halfSpan
      && world.y + radius >= center.y - halfSpan
      && world.y - radius <= center.y + halfSpan
    );
  }
}
