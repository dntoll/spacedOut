import { add, dot, length, scale, sub } from '../math';
import type { Vec2 } from '../types';
import type { AsteroidCavity } from './MassiveAsteroid';

export class AsteroidCavityField {
  create(radius: number, vertices: number[], count: number, random = Math.random): AsteroidCavity[] {
    const polygon = vertices.map((variation, index) => {
      const angle = index / vertices.length * Math.PI * 2;
      return { x: Math.cos(angle) * radius * variation, y: Math.sin(angle) * radius * variation };
    });

    return Array.from({ length: count }, (_, index) => {
      const cavityRadius = this.createRadius(radius, index, random);
      return {
        position: this.findPosition(
          polygon,
          radius,
          cavityRadius,
          index === count - 1 ? radius * 0.32 : 0,
          random,
        ),
        radius: cavityRadius,
      };
    });
  }

  private createRadius(asteroidRadius: number, index: number, random: () => number): number {
    if (index === 0) return (0.14 + random() * 0.04) * asteroidRadius;
    if (index < 3) return (0.08 + random() * 0.04) * asteroidRadius;
    return (0.02 + random() * 0.065) * asteroidRadius;
  }

  private findPosition(
    polygon: Vec2[],
    asteroidRadius: number,
    cavityRadius: number,
    minDistance: number,
    random: () => number,
  ): Vec2 {
    const clearance = asteroidRadius * 0.008;
    for (let attempt = 0; attempt < 500; attempt++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * asteroidRadius * 1.08;
      if (distance < minDistance) continue;
      const candidate = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
      if (
        this.isInside(candidate, polygon)
        && this.distanceFromOutline(candidate, polygon) >= cavityRadius + clearance
      ) return candidate;
    }

    return { x: 0, y: 0 };
  }

  private isInside(point: Vec2, polygon: Vec2[]): boolean {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
      const a = polygon[index];
      const b = polygon[previous];
      if (
        (a.y > point.y) !== (b.y > point.y)
        && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x
      ) inside = !inside;
    }
    return inside;
  }

  private distanceFromOutline(point: Vec2, polygon: Vec2[]): number {
    let nearest = Number.POSITIVE_INFINITY;
    for (let index = 0; index < polygon.length; index++) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      const edge = sub(end, start);
      const edgeLengthSquared = dot(edge, edge);
      const amount = edgeLengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, dot(sub(point, start), edge) / edgeLengthSquared));
      nearest = Math.min(nearest, length(sub(point, add(start, scale(edge, amount)))));
    }
    return nearest;
  }
}
