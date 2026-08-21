import type * as Model from '../model';
import type { Bounds, ControlTuning, Vec2 } from '../types';
import { MissionPhase } from '../model';
import { AsteroidBelt } from './AsteroidBelt';
import { Camera } from './Camera';
import { CompositeShadowCasters } from './CompositeShadowCasters';
import { DistanceMeter } from './DistanceMeter';
import { Drawing } from './Drawing';
import { DroneField } from './DroneField';
import { ExplorationMap } from './ExplorationMap';
import { Hud } from './Hud';
import { LaserField } from './LaserField';
import { MassiveAsteroidField } from './MassiveAsteroidField';
import { Minimap } from './Minimap';
import { MissionOverlay } from './MissionOverlay';
import { MissionGoals } from './MissionGoals';
import { MissionsMenu, type MissionSelection } from './MissionsMenu';
import { MusicSystem } from './MusicSystem';
import { NebulaField } from './NebulaField';
import { ParticleField } from './ParticleField';
import { PirateField } from './PirateField';
import { PlayerInput } from './PlayerInput';
import { SettingsMenu } from './SettingsMenu';
import { ShadowVolume } from './ShadowVolume';
import { Ship } from './Ship';
import { SignalIndicator } from './SignalIndicator';
import { SoundGate } from './SoundGate';
import { SoundSystem } from './SoundSystem';
import { SpaceBackground } from './SpaceBackground';
import { StarLight } from './StarLight';
import { Station } from './Station';
import { StorageAdapter } from './StorageAdapter';
import { SupplyField } from './SupplyField';

export class Game implements Model.CollisionObserver, Model.DamageObserver, Model.AsteroidDestroyedObserver, Model.LaserShotObserver, Model.LaserImpactObserver, Model.AsteroidCollisionObserver, Model.CollectablePickupObserver, Model.DroneDestroyedObserver, Model.PirateDestroyedObserver, Model.PirateLaserShotObserver, Model.PirateCollisionObserver {
  private readonly drawing: Drawing;
  private readonly camera = new Camera();
  private readonly hud = new Hud();
  private readonly distanceMeter = new DistanceMeter();
  private readonly settings: SettingsMenu;
  private readonly input: PlayerInput;
  private readonly background = new SpaceBackground();
  private readonly starLight = new StarLight();
  private readonly shadowVolume = new ShadowVolume();
  private readonly ship = new Ship();
  private readonly asteroidBelt = new AsteroidBelt();
  private readonly massiveAsteroidField = new MassiveAsteroidField();
  private readonly supplyField = new SupplyField();
  private readonly laserField = new LaserField();
  private readonly droneField = new DroneField();
  private readonly pirateField = new PirateField();
  private readonly station = new Station();
  private readonly bare = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('bare');
  private readonly particleField = new ParticleField();
  private readonly nebulaField = new NebulaField();
  private readonly explorationMap = new ExplorationMap();
  private readonly minimap = new Minimap();
  private readonly missionOverlay = new MissionOverlay();
  private readonly missionGoals = new MissionGoals();
  private readonly missionsMenu = new MissionsMenu();
  private readonly signalIndicator = new SignalIndicator();
  private readonly music = MusicSystem.create();
  private readonly sounds = SoundSystem.create();
  private readonly soundGate = new SoundGate(this.camera, this.sounds, () => this.drawing.size);
  private readonly gameOverNode = document.querySelector<HTMLElement>('#game-over');
  private restartRequested = false;
  private previousMissionPhase: Model.MissionPhase | null = null;

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
  getDiscoveredBounds(): Bounds { return this.camera.getVisibleWorldBounds(this.drawing.size); }
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
    this.particleField.emitExplosion(event.position, { r: 93, g: 184, b: 255 });
  }

  onPirateDestroyed(event: Model.PirateDestroyed): void {
    this.particleField.emitExplosion(event.position, { r: 255, g: 106, b: 74 });
  }

  onPirateLaserShot(event: Model.LaserShot): void {
    this.soundGate.onPirateLaserShot(event);
  }

  onPirateCollision(collision: Model.Collision): void {
    this.soundGate.onPirateCollision(collision);
  }

  consumeRestartRequest(): boolean {
    if (this.restartRequested) {
      this.restartRequested = false;
      return true;
    }
    return false;
  }

  consumeMissionContinueClick(): boolean { return this.missionOverlay.consumeClick(); }

  consumeMissionSelection(): MissionSelection | null { return this.missionsMenu.consumeSelection(); }

  reset(): void {
    this.explorationMap.reset();
    this.particleField.reset();
    this.nebulaField.reset();
    this.sounds.reset();
    this.station.reset();
    this.previousMissionPhase = null;
    this.music.resetMission();
  }

  private missionNumberFor(phase: Model.MissionPhase): 1 | 2 | 3 | null {
    switch (phase) {
      case MissionPhase.Mission1Active: return 1;
      case MissionPhase.Mission2Active: return 2;
      case MissionPhase.Mission3Active: return 3;
      case MissionPhase.Mission3Done: return 3;
      default: return null;
    }
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

  private anyHuntingPirateOnScreen(model: Model.Game): boolean {
    const bounds = this.camera.getVisibleWorldBounds(this.drawing.size);
    let found = false;
    model.pirateField.forEachPirate((pirate) => {
      if (found || !pirate.isHunting) return;
      if (pirate.position.x >= bounds.left && pirate.position.x <= bounds.right
        && pirate.position.y >= bounds.top && pirate.position.y <= bounds.bottom) found = true;
    });
    return found;
  }

  render(model: Model.Game, dt: number): void {
    this.camera.setBaseZoom(this.settings.getDefaultZoomLevel());
    this.camera.setViewport(this.drawing.size);
    this.camera.update(model.ship.position, model.ship.velocity, dt, model.droneField.anyHunting() || model.pirateField.anyHunting(), model.mission.isTraversal);
    this.explorationMap.observe(this.camera.getVisibleWorldBounds(this.drawing.size));
    this.particleField.update(dt, model, this.camera, this.drawing.size);
    this.nebulaField.update(dt, model, this.camera, this.drawing.size);
    const phase = model.mission.phase;
    if (phase !== this.previousMissionPhase) {
      const mission = this.missionNumberFor(phase);
      if (mission !== null) this.music.startMission(mission);
      this.previousMissionPhase = phase;
    }
    this.music.update(this.getMusicLevel(), dt, model.droneField.anyHunting() || model.pirateField.anyHunting());
    const particleVisibility = this.settings.getParticleVisibility();
    this.particleField.setVisibility(particleVisibility);
    this.sounds.setSettings(this.settings.getSfxSettings());
    this.sounds.setThrusting(model.ship.isAlive && model.thrusting);
    this.sounds.setDroneThrusting(this.anyHuntingDroneOnScreen(model));
    this.sounds.setPirateThrusting(this.anyHuntingPirateOnScreen(model));
    this.sounds.update();

    this.background.draw(this.drawing, this.camera.worldPosition);
    const casters = new CompositeShadowCasters(model.massiveAsteroidField, model.asteroidBelt);
    this.shadowVolume.render(this.drawing, casters, this.starLight, this.camera);
    this.drawing.compositeShadowLayer('multiply');
    this.camera.drawWorld(this.drawing, () => {
      const lampRadius = phase === MissionPhase.Mission3Active ? this.settings.getLampRadius() : 0;
      this.station.draw(this.drawing, model.station, this.starLight, this.camera.zoom, model.ship.position, this.camera.worldPosition, lampRadius, this.bare);
      this.massiveAsteroidField.draw(this.drawing, model.massiveAsteroidField, model.ship.position, this.camera, this.starLight);
      this.nebulaField.draw(this.drawing, this.camera.getVisibleWorldBounds(this.drawing.size));
      this.particleField.draw(this.drawing, this.starLight, casters);
      this.supplyField.draw(this.drawing, model.supplyField, this.starLight, casters);
      this.asteroidBelt.draw(this.drawing, model.asteroidBelt, model.ship.position, this.camera, this.starLight, casters);
      this.droneField.draw(this.drawing, model.droneField, model.ship, this.camera, this.starLight, casters);
      this.pirateField.draw(this.drawing, model.pirateField, model.ship, this.camera, this.starLight, casters);
      this.laserField.draw(this.drawing, model.laserField);
      if (model.ship.isAlive) this.ship.draw(this.drawing, model.ship, this.starLight, casters);
    });
    this.background.drawVignette(this.drawing);
    this.minimap.draw(this.drawing, this.explorationMap, model, this.camera);
    this.signalIndicator.draw(this.drawing, model, this.camera);
    this.hud.updateSpeed(model.speed, model.damageSpeedThreshold);
    this.hud.updateResources(model.ship.fuel, model.ship.hp, model.ship.ammo);
    this.distanceMeter.update(model.mission);
    this.missionGoals.update(model.mission.currentGoals);
    if (model.isGameOver) {
      this.gameOverNode?.classList.remove('hidden');
      this.missionOverlay.hide();
    } else {
      this.gameOverNode?.classList.add('hidden');
      this.missionOverlay.show(model.mission.phase);
    }
    this.missionsMenu.setCurrentMissionFrom(model.mission.phase);
  }

  private resize(): void {
    this.drawing.resize();
    this.background.resize(this.drawing.size);
  }

  private localStorage(): Storage | null {
    try { return window.localStorage; } catch { return null; }
  }
}
