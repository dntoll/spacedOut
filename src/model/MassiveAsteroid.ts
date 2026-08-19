import type { Vec2 } from '../types';
import { PhysicsBody } from './PhysicsBody';

export interface AsteroidCavity {
  position: Vec2;
  radius: number;
}

export class MassiveAsteroid extends PhysicsBody {
  constructor(
    public readonly id: number,
    position: Vec2,
    radius: number,
    angle: number,
    public readonly vertices: number[],
    public readonly cavities: AsteroidCavity[],
    public readonly shade: number,
  ) {
    super(position, { x: 0, y: 0 }, radius, Number.POSITIVE_INFINITY, angle, 0);
  }

  static boundaryRadiusAt(asteroid: MassiveAsteroid, worldPosition: Vec2): number {
    const worldAngle = Math.atan2(
      worldPosition.y - asteroid.position.y,
      worldPosition.x - asteroid.position.x,
    );
    const localAngle = ((worldAngle - asteroid.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const vertexPosition = localAngle / (Math.PI * 2) * asteroid.vertices.length;
    const firstIndex = Math.floor(vertexPosition) % asteroid.vertices.length;
    const secondIndex = (firstIndex + 1) % asteroid.vertices.length;
    const blend = vertexPosition - Math.floor(vertexPosition);
    const variation = asteroid.vertices[firstIndex] * (1 - blend) + asteroid.vertices[secondIndex] * blend;
    return asteroid.radius * variation;
  }
}
