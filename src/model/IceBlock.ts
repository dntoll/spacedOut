import { scale } from '../math';
import type { Vec2 } from '../types';
import { BodyMass } from './BodyMass';
import { PhysicsBody } from './PhysicsBody';

export class IceBlock extends PhysicsBody {
  constructor(
    public readonly id: number,
    public orbitalRadius: number,
    public orbitalAngle: number,
    public readonly orbitSpeed: number,
    radius: number,
    angle: number,
    angularVelocity: number,
    public readonly vertices: number[],
  ) {
    super({ x: 0, y: 0 }, { x: 0, y: 0 }, radius, BodyMass.fromRadius(radius, 0.0045), angle, angularVelocity);
  }

  orbit(center: Vec2, dt: number): void {
    this.previousPosition = { ...this.position };
    this.orbitalAngle += this.orbitSpeed * dt;
    this.angle += this.angularVelocity * dt;
    const c = Math.cos(this.orbitalAngle);
    const s = Math.sin(this.orbitalAngle);
    this.position = { x: center.x + c * this.orbitalRadius, y: center.y + s * this.orbitalRadius };
    const tangential = this.orbitSpeed * this.orbitalRadius;
    this.velocity = { x: -s * tangential, y: c * tangential };
  }

  snapToOrbit(center: Vec2): void {
    const c = Math.cos(this.orbitalAngle);
    const s = Math.sin(this.orbitalAngle);
    this.position = { x: center.x + c * this.orbitalRadius, y: center.y + s * this.orbitalRadius };
    this.previousPosition = { ...this.position };
    const tangential = this.orbitSpeed * this.orbitalRadius;
    this.velocity = { x: -s * tangential, y: c * tangential };
  }
}

export const createIceVertices = (count: number, jitter: () => number): number[] => {
  const vertices: number[] = [];
  for (let i = 0; i < count; i++) vertices.push(0.45 + jitter() * 0.7);
  return vertices;
};

export const iceLocalVertex = (block: IceBlock, index: number): Vec2 => {
  const angle = (index / block.vertices.length) * Math.PI * 2;
  const radius = block.radius * block.vertices[index];
  return scale({ x: Math.cos(angle), y: Math.sin(angle) }, radius);
};
