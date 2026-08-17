import type * as Model from '../model';
import type { ControlTuning, Vec2 } from '../types';
import { AsteroidBelt } from './AsteroidBelt';
import { Camera } from './Camera';
import { Drawing } from './Drawing';
import { DroneField } from './DroneField';
import { ExplorationMap } from './ExplorationMap';
import { Hud } from './Hud';
import { LaserField } from './LaserField';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import { Minimap } from './Minimap';
import { MissionOverlay } from './MissionOverlay';
import { MusicSystem } from './MusicSystem';
import { ParticleField } from './ParticleField';
import { PlayerInput } from './PlayerInput';
import { SettingsMenu } from './SettingsMenu';
import { Ship } from './Ship';
import { SoundGate } from './SoundGate';
import { SoundSystem } from './SoundSystem';
import { SpaceBackground } from './SpaceBackground';
import { StorageAdapter } from './StorageAdapter';
import { SupplyField } from './SupplyField';

export class Game implements Model.CollisionObserver, Model.DamageObserver, Model.AsteroidDestroyedObserver, Model.LaserShotObserver, Model.LaserImpactObserver, Model.AsteroidCollisionObserver, Model.CollectablePickupObserver, Model.DroneDestroyedObserver {
  private readonly drawing: Drawing;
  private readonly camera = new Camera();
  private readonly hud = new Hud();
  private readonly settings: SettingsMenu;
  private readonly input: PlayerInput;
  private readonly background = new SpaceBackground();
  private readonly ship = new Ship();
  private readonly asteroidBelt = new AsteroidBelt();
  private readonly massiveAsteroidField = new MassiveAsteroidField();
  private readonly supplyField = new SupplyField();
  private readonly laserField = new LaserField();
  private readonly droneField = new DroneField();
  private readonly particleField = new ParticleField();
  private readonly explorationMap = new ExplorationMap();
  private readonly minimap = new Minimap();
  private readonly missionOverlay = new MissionOverlay();
  private readonly music = MusicSystem.create();
  private readonly sounds = SoundSystem.create();
  private readonly soundGate = new SoundGate(this.camera, this.sounds, () => this.drawing.size);
  private readonly gameOverNode = document.querySelector<HTMLElement>('#game-over');
  private restartRequested = false;

  constructor(canvasSelector: string) {
    this.drawing = new Drawing(canvasSelector);
    this.settings = new SettingsMenu(new StorageAdapter(this.localStorage()));
    this.input = new PlayerInput(this.drawing, () => this.hud.dismissHint());
    this.resize();
    this.drawing.onResize(() => this.resize());
    this.gameOverNode?.addEventListener('click', () => { this.restartRequested = true; });
  }

  get isPlayerThrusting(): boolean { return this.input.isThrusting; }
  get isPlayerFiring(): boolean { return this.input.isFiring; }
  getThrustTarget(): Vec2 { return this.input.getTarget(this.camera); }
  getDirectionalThrust(): Vec2 | null { return this.input.getDirectionalThrust(); }
  getSpawnExclusionRadius(): number { return this.camera.getVisibleWorldRadius(this.drawing.size); }
  getControlTuning(): ControlTuning { return this.settings.getControlTuning(); }
  getMusicLevel(): number { return this.settings.getMusicLevel(); }

  onCollision(collision: Model.Collision): void {
    this.particleField.emitCollision(collision);
  }

  onDamage(damage: Model.Damage): void {
    this.particleField.emitDamageBurst(damage.position);
    if (damage.lethal) this.particleField.emitExplosion(damage.position);
    this.soundGate.onShipCollision(damage);
  }

  onDestroyed(event: Model.AsteroidDestroyed): void {
    this.particleField.emitExplosion(event.position);
  }

  onLaserShot(event: Model.LaserShot): void {
    this.soundGate.onLaserShot(event);
    this.music.recordLaserShot();
  }

  onLaserImpact(collision: Model.Collision): void {
    this.soundGate.onLaserImpact(collision);
  }

  onAsteroidCollision(collision: Model.Collision): void {
    this.soundGate.onAsteroidCollision(collision);
  }

  onCollectablePickup(event: Model.CollectablePickup): void {
    this.soundGate.onCollectable(event);
  }

  onDroneDestroyed(event: Model.DroneDestroyed): void {
    this.particleField.emitExplosion(event.position);
  }

  consumeRestartRequest(): boolean {
    if (this.restartRequested) {
      this.restartRequested = false;
      return true;
    }
    return false;
  }

  consumeMissionContinueClick(): boolean { return this.missionOverlay.consumeClick(); }

  reset(): void {
    this.explorationMap.reset();
    this.particleField.reset();
    this.sounds.reset();
  }

  private anyHuntingDroneOnScreen(model: Model.Game): boolean {
    const bounds = this.camera.getVisibleWorldBounds(this.drawing.size);
    let found = false;
    model.droneField.forEach((drone) => {
      if (found || !drone.isHunting) return;
      if (drone.position.x >= bounds.left && drone.position.x <= bounds.right
        && drone.position.y >= bounds.top && drone.position.y <= bounds.bottom) found = true;
    });
    return found;
  }

  render(model: Model.Game, dt: number): void {
    this.camera.setBaseZoom(this.settings.getDefaultZoomLevel());
    this.camera.update(model.ship.position, model.speed, dt);
    this.explorationMap.observe(this.camera.getVisibleWorldBounds(this.drawing.size));
    this.particleField.update(dt, model, this.camera, this.drawing.size);
    this.music.update(this.getMusicLevel(), dt, model.droneField.anyHunting());
    const particleVisibility = this.settings.getParticleVisibility();
    this.particleField.setVisibility(particleVisibility);
    this.sounds.setSettings(this.settings.getSfxSettings());
    this.sounds.setThrusting(model.ship.isAlive && model.thrusting);
    this.sounds.setDroneThrusting(this.anyHuntingDroneOnScreen(model));
    this.sounds.update();

    this.background.draw(this.drawing, this.camera.worldPosition);
    this.camera.drawWorld(this.drawing, () => {
      this.massiveAsteroidField.draw(this.drawing, model.massiveAsteroidField, model.ship.position, this.camera);
      this.particleField.draw(this.drawing);
      this.supplyField.draw(this.drawing, model.supplyField);
      this.asteroidBelt.draw(this.drawing, model.asteroidBelt, model.ship.position, this.camera);
      this.droneField.draw(this.drawing, model.droneField, model.ship.position, this.camera);
      this.laserField.draw(this.drawing, model.laserField);
      if (model.ship.isAlive) this.ship.draw(this.drawing, model.ship);
    });
    this.background.drawVignette(this.drawing);
    this.minimap.draw(this.drawing, this.explorationMap, model, this.camera);
    this.hud.updateSpeed(model.speed);
    this.hud.updateResources(model.ship.fuel, model.ship.hp, model.ship.ammo);
    if (model.isGameOver) {
      this.gameOverNode?.classList.remove('hidden');
      this.missionOverlay.hide();
    } else {
      this.gameOverNode?.classList.add('hidden');
      this.missionOverlay.show(model.mission.phase);
    }
  }

  private resize(): void {
    this.drawing.resize();
    this.background.resize(this.drawing.size);
  }

  private localStorage(): Storage | null {
    try { return window.localStorage; } catch { return null; }
  }
}
