import type { Collision } from '../model/Collision';
import type { CollectablePickup } from '../model/CollectablePickup';
import type { Damage } from '../model/Damage';
import type { LaserShot } from '../model/LaserShot';
import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Size } from './Drawing';
import type { SoundSystem } from './SoundSystem';

export class SoundGate {
  constructor(
    private readonly camera: Camera,
    private readonly sounds: SoundSystem,
    private readonly viewport: () => Size,
  ) {}

  onLaserShot(event: LaserShot): void {
    if (this.onScreen(event.position)) this.sounds.onLaserShot();
  }

  onLaserImpact(collision: Collision): void {
    if (this.onScreen(collision.position)) this.sounds.onLaserImpact();
  }

  onAsteroidCollision(collision: Collision): void {
    if (this.onScreen(collision.position)) this.sounds.onAsteroidCollision();
  }

  onShipCollision(damage: Damage): void {
    if (this.onScreen(damage.position)) this.sounds.onShipCollision();
  }

  onCollectable(event: CollectablePickup): void {
    if (this.onScreen(event.position)) this.sounds.onCollectable();
  }

  onPirateLaserShot(event: LaserShot): void {
    if (this.onScreen(event.position)) this.sounds.onPirateLaserShot();
  }

  onPirateCollision(collision: Collision): void {
    if (this.onScreen(collision.position)) this.sounds.onPirateCollision();
  }

  private onScreen(position: Vec2): boolean {
    const bounds = this.camera.getVisibleWorldBounds(this.viewport());
    return position.x >= bounds.left
      && position.x <= bounds.right
      && position.y >= bounds.top
      && position.y <= bounds.bottom;
  }
}
