import type { Vec2 } from '../types';
import { PhysicsBody } from './PhysicsBody';

export interface AsteroidCavity {
  position: Vec2;
  radius: number;
}

export interface RadialPolygon {
  position: Vec2;
  angle: number;
  vertices: number[];
  radius: number;
}

export const boundaryRadiusAt = (body: RadialPolygon, worldPosition: Vec2): number => {
  const worldAngle = Math.atan2(
    worldPosition.y - body.position.y,
    worldPosition.x - body.position.x,
  );
  const localAngle = ((worldAngle - body.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const vertexPosition = localAngle / (Math.PI * 2) * body.vertices.length;
  const firstIndex = Math.floor(vertexPosition) % body.vertices.length;
  const secondIndex = (firstIndex + 1) % body.vertices.length;
  const blend = vertexPosition - Math.floor(vertexPosition);
  const variation = body.vertices[firstIndex] * (1 - blend) + body.vertices[secondIndex] * blend;
  return body.radius * variation;
};

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
    super(position, { x: 0, y: 0 }, radius, Number.POSITIVE_INFINITY, angle, 0, true);
  }

  static boundaryRadiusAt(asteroid: MassiveAsteroid, worldPosition: Vec2): number {
    return boundaryRadiusAt(asteroid, worldPosition);
  }
}
