import { length, sub } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing, RadialPaint } from './Drawing';

const ISLAND_RING_COLOR = 'rgba(255,180,90,.24)';
const ISLAND_RING_FILL = 'rgba(255,180,90,.06)';
const ISLAND_EARLY_WARN = 1400;

export class AsteroidBelt {
  draw(drawing: Drawing, belt: Model.AsteroidBelt, shipPosition: Vec2, camera: Camera): void {
    const { width, height } = drawing.size;
    const visibleRange = Math.hypot(width, height) / camera.zoom * 0.7 + 100;
    belt.forEachIsland((island) => {
      if (length(sub(island.center, shipPosition)) <= visibleRange + island.radius + ISLAND_EARLY_WARN) {
        drawing.polygon(island.outline, ISLAND_RING_FILL, ISLAND_RING_COLOR, 1.5 / camera.zoom);
      }
    });
    belt.forEach((asteroid) => {
      if (length(sub(asteroid.position, shipPosition)) <= visibleRange) this.drawAsteroid(drawing, asteroid, camera.zoom);
    });
  }

  private drawAsteroid(drawing: Drawing, asteroid: Model.Asteroid, zoom: number): void {
    drawing.withTransform(asteroid.position, asteroid.angle, () => {
      const points = asteroid.vertices.map((variation, index) => {
        const angle = (index / asteroid.vertices.length) * Math.PI * 2;
        const radius = asteroid.radius * variation;
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      });
      const rock: RadialPaint = {
        from: { x: -asteroid.radius * 0.32, y: -asteroid.radius * 0.38 }, fromRadius: 0,
        to: { x: 0, y: 0 }, toRadius: asteroid.radius * 1.2,
        stops: [
          { offset: 0, color: asteroid.shade > 0.5 ? '#536175' : '#424d5f' },
          { offset: 0.48, color: '#242d3d' },
          { offset: 1, color: '#0b101b' },
        ],
      };
      drawing.polygon(points, rock, 'rgba(142,174,208,.38)', 1.3 / zoom);
      drawing.circle({ x: -asteroid.radius * 0.22, y: -asteroid.radius * 0.05 }, asteroid.radius * 0.16, 'rgba(4,7,15,.3)');
    });
  }
}
