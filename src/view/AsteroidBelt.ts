import { length, sub } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing } from './Drawing';
import type { StarLight, ShadowCasters } from './StarLight';

const ISLAND_RING_COLOR = 'rgba(255,180,90,.24)';
const ISLAND_RING_FILL = 'rgba(255,180,90,.06)';
const ISLAND_EARLY_WARN = 1400;

export class AsteroidBelt {
  draw(drawing: Drawing, belt: Model.AsteroidBelt, shipPosition: Vec2, camera: Camera, starLight: StarLight, casters: ShadowCasters | null): void {
    const { width, height } = drawing.size;
    const visibleRange = Math.hypot(width, height) / camera.zoom * 0.7 + 100;
    belt.forEachIsland((island) => {
      if (length(sub(island.center, shipPosition)) <= visibleRange + island.radius + ISLAND_EARLY_WARN) {
        drawing.polygon(island.outline, ISLAND_RING_FILL, ISLAND_RING_COLOR, 1.5 / camera.zoom);
      }
    });
    belt.forEach((asteroid) => {
      if (length(sub(asteroid.position, shipPosition)) <= visibleRange) this.drawAsteroid(drawing, asteroid, camera.zoom, starLight, casters);
    });
  }

  private drawAsteroid(drawing: Drawing, asteroid: Model.Asteroid, zoom: number, starLight: StarLight, casters: ShadowCasters | null): void {
    drawing.withTransform(asteroid.position, asteroid.angle, () => {
      const points = asteroid.vertices.map((variation, index) => {
        const angle = (index / asteroid.vertices.length) * Math.PI * 2;
        const radius = asteroid.radius * variation;
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      });
      const localLight = starLight.localDirection(asteroid.angle, asteroid.position);
      const shadow = starLight.shadowFactor(asteroid.position, asteroid.radius, casters);
      const lit = asteroid.shade > 0.5 ? '#536175' : '#424d5f';
      const rock = starLight.bodyPaint(localLight, asteroid.radius, lit, '#0b101b', shadow);
      drawing.polygon(points, rock, 'rgba(142,174,208,.38)', 1.3 / zoom);
      drawing.circle({ x: -asteroid.radius * 0.22, y: -asteroid.radius * 0.05 }, asteroid.radius * 0.16, 'rgba(4,7,15,.3)');
    });
  }
}
