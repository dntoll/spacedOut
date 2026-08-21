import { random } from '../math';
import type { AsteroidBelt } from './AsteroidBelt';
import { CollisionResolver } from './CollisionResolver';
import type { CollisionObserver } from './CollisionObserver';
import { IceBlock, createIceVertices } from './IceBlock';
import type { Star } from './Star';
import type { SupplyField } from './SupplyField';

export const ICE_RING_INNER_RADIUS = 8000;
export const ICE_RING_OUTER_RADIUS = 9800;
const ICE_COUNT = 48;
const MIN_RADIUS = 18;
const MAX_RADIUS = 78;

export class IceRing {
  private readonly blocks: IceBlock[] = [];
  private readonly collisionObservers = new Set<CollisionObserver>();

  get isPlaced(): boolean { return this.blocks.length > 0; }
  get innerRadius(): number { return ICE_RING_INNER_RADIUS; }
  get outerRadius(): number { return ICE_RING_OUTER_RADIUS; }
  get count(): number { return this.blocks.length; }

  forEach(visitor: (block: IceBlock) => void): void { this.blocks.forEach(visitor); }

  addCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.add(observer); }
  removeCollisionObserver(observer: CollisionObserver): void { this.collisionObservers.delete(observer); }

  placeAround(star: Star): void {
    this.blocks.length = 0;
    if (!star.isPlaced) return;
    const center = star.position;
    for (let i = 0; i < ICE_COUNT; i++) {
      const orbit = random(ICE_RING_INNER_RADIUS, ICE_RING_OUTER_RADIUS);
      const angle = (i / ICE_COUNT) * Math.PI * 2 + random(-0.08, 0.08);
      const radius = random(MIN_RADIUS, MAX_RADIUS);
      const sides = 5 + Math.floor(random(0, 4));
      const spin = random(-0.6, 0.6);
      const speed = random(0.055, 0.09);
      const block = new IceBlock(i, orbit, angle, speed, radius, random(0, Math.PI * 2), spin, createIceVertices(sides, () => Math.random()));
      block.snapToOrbit(center);
      this.blocks.push(block);
    }
  }

  clear(): void { this.blocks.length = 0; }

  update(dt: number, star: Star): void {
    if (!star.isPlaced) return;
    const center = star.position;
    for (const block of this.blocks) block.orbit(center, dt);
  }

  resolveBodyCollisions(asteroidBelt: AsteroidBelt, supplyField: SupplyField): void {
    for (const block of this.blocks) {
      asteroidBelt.forEach((asteroid) => this.emit(CollisionResolver.resolve(block, asteroid)));
      supplyField.forEachActive((container) => this.emit(CollisionResolver.resolve(block, container)));
    }
  }

  private emit(collision: ReturnType<typeof CollisionResolver.resolve>): void {
    if (!collision) return;
    for (const observer of this.collisionObservers) observer.onCollision(collision);
  }
}
