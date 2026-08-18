import { length, sub } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing, RadialPaint } from './Drawing';
import type { StarLight } from './StarLight';

export class MassiveAsteroidField {
  draw(drawing: Drawing, field: Model.MassiveAsteroidField, shipPosition: Vec2, camera: Camera, starLight: StarLight): void {
    const { width, height } = drawing.size;
    const visibleRange = Math.hypot(width, height) / camera.zoom * 0.7;
    field.forEachActive((asteroid) => {
      if (length(sub(asteroid.position, shipPosition)) <= visibleRange + asteroid.radius) {
        this.drawAsteroid(drawing, asteroid, camera.zoom, starLight);
      }
    });
  }

  private drawAsteroid(drawing: Drawing, asteroid: Model.MassiveAsteroid, zoom: number, starLight: StarLight): void {
    drawing.withTransform(asteroid.position, asteroid.angle, () => {
      const points = asteroid.vertices.map((variation, index) => {
        const angle = (index / asteroid.vertices.length) * Math.PI * 2;
        return {
          x: Math.cos(angle) * asteroid.radius * variation,
          y: Math.sin(angle) * asteroid.radius * variation,
        };
      });
      const localLight = starLight.localDirection(asteroid.angle);
      const lit = asteroid.shade > 0.5 ? '#35465a' : '#303c50';
      const rock = starLight.bodyPaint(localLight, asteroid.radius, lit, '#070b12', 0);
      drawing.polygon(points, rock, 'rgba(132,170,205,.34)', 2 / zoom);

      for (const cavity of asteroid.cavities) {
        const cavityPaint: RadialPaint = {
          from: { x: cavity.position.x - cavity.radius * 0.25, y: cavity.position.y - cavity.radius * 0.25 },
          fromRadius: 0,
          to: cavity.position,
          toRadius: cavity.radius,
          stops: [
            { offset: 0, color: 'rgba(5,9,16,.9)' },
            { offset: 0.72, color: 'rgba(8,13,22,.78)' },
            { offset: 1, color: 'rgba(74,101,128,.2)' },
          ],
        };
        drawing.circle(cavity.position, cavity.radius, cavityPaint, 'rgba(92,125,151,.16)', 1 / zoom);
      }
    });
  }
}
