import { clamp } from '../math';
import { DEFAULT_THRUST_SPLITS, ThrustSound, type ThrustAudio } from './ThrustSound';

export interface SoundClip {
  play(): void;
  stop(): void;
  setVolume(volume: number): void;
}

export enum SfxChannel {
  Master = 'master',
  Thrust = 'thrust',
  LaserShot = 'laser-shot',
  LaserHit = 'laser-hit',
  AsteroidCollision = 'asteroid-collision',
  ShipCollision = 'ship-collision',
  Collectable = 'collectable',
}

export interface SfxSettings {
  master: number;
  thrust: number;
  laserShot: number;
  laserHit: number;
  asteroidCollision: number;
  shipCollision: number;
  collectable: number;
}

export const DEFAULT_SFX_SETTINGS: SfxSettings = {
  master: 1,
  thrust: 1,
  laserShot: 1,
  laserHit: 1,
  asteroidCollision: 1,
  shipCollision: 1,
  collectable: 1,
};

const ONE_SHOT_CHANNELS: readonly SfxChannel[] = [
  SfxChannel.LaserShot,
  SfxChannel.LaserHit,
  SfxChannel.AsteroidCollision,
  SfxChannel.ShipCollision,
  SfxChannel.Collectable,
];

const DRONE_THRUST_VOLUME_SCALE = 0.35;
const PIRATE_THRUST_VOLUME_SCALE = 0.35;
const PIRATE_LASER_VOLUME_SCALE = 0.5;
const PIRATE_COLLISION_VOLUME_SCALE = 0.5;

export interface SoundSystemOptions {
  window?: Window;
  rng?: () => number;
  droneThrust?: ThrustSound;
  pirateThrust?: ThrustSound;
}

export class SoundSystem {
  private readonly clips: Record<SfxChannel, SoundClip[]>;
  private readonly thrust: ThrustSound;
  private readonly droneThrust: ThrustSound;
  private readonly pirateThrust: ThrustSound;
  private readonly rng: () => number;
  private volumes: SfxSettings = { ...DEFAULT_SFX_SETTINGS };
  private unlocked = false;
  private thrustActive = false;
  private droneThrustActive = false;
  private pirateThrustActive = false;

  constructor(
    clips: Partial<Record<SfxChannel, SoundClip[]>>,
    thrust: ThrustSound,
    options?: SoundSystemOptions,
  ) {
    this.clips = emptyClips();
    for (const channel of ONE_SHOT_CHANNELS) {
      const provided = clips[channel];
      if (provided) this.clips[channel] = [...provided];
    }
    this.thrust = thrust;
    this.droneThrust = options?.droneThrust ?? thrust;
    this.pirateThrust = options?.pirateThrust ?? thrust;
    this.rng = options?.rng ?? Math.random;
    if (options?.window) this.attachUnlock(options.window);
  }

  static create(): SoundSystem {
    const modules = import.meta.glob('/assets/sounds/*/*', {
      eager: true,
      query: '?url',
      import: 'default',
    }) as Record<string, string>;
    const clips = emptyClips();
    let thrustUrl: string | undefined;
    for (const [path, url] of Object.entries(modules)) {
      const folder = path.split('/').slice(-2, -1)[0] ?? '';
      if (folder === 'thrust') { if (!thrustUrl) thrustUrl = url; continue; }
      const channel = folderToChannel(folder);
      if (!channel) continue;
      clips[channel].push(new HtmlSoundClip(url));
    }
    const thrustAudio = thrustUrl ? new HtmlThrustAudio(thrustUrl) : new NullThrustAudio();
    const thrust = new ThrustSound(thrustAudio, DEFAULT_THRUST_SPLITS);
    const droneAudio = thrustUrl ? new HtmlThrustAudio(thrustUrl) : new NullThrustAudio();
    const droneThrust = new ThrustSound(droneAudio, DEFAULT_THRUST_SPLITS);
    const pirateAudio = thrustUrl ? new HtmlThrustAudio(thrustUrl) : new NullThrustAudio();
    const pirateThrust = new ThrustSound(pirateAudio, DEFAULT_THRUST_SPLITS);
    return new SoundSystem(clips, thrust, { window, droneThrust, pirateThrust });
  }

  unlock(): void { this.unlocked = true; }

  setSettings(settings: SfxSettings): void {
    this.volumes = clampSettings(settings);
    this.applyThrustVolume();
    this.applyDroneThrustVolume();
    this.applyPirateThrustVolume();
  }

  setThrusting(active: boolean): void {
    if (!this.unlocked) {
      if (this.thrustActive) { this.thrust.reset(); this.thrustActive = false; }
      return;
    }
    if (active && !this.thrustActive) {
      this.applyThrustVolume();
      this.thrust.start();
      this.thrustActive = true;
    } else if (!active && this.thrustActive) {
      this.thrust.stop();
      this.thrustActive = false;
    }
  }

  setDroneThrusting(active: boolean): void {
    if (!this.unlocked) {
      if (this.droneThrustActive) { this.droneThrust.reset(); this.droneThrustActive = false; }
      return;
    }
    if (active && !this.droneThrustActive) {
      this.applyDroneThrustVolume();
      this.droneThrust.start();
      this.droneThrustActive = true;
    } else if (!active && this.droneThrustActive) {
      this.droneThrust.stop();
      this.droneThrustActive = false;
    }
  }

  setPirateThrusting(active: boolean): void {
    if (!this.unlocked) {
      if (this.pirateThrustActive) { this.pirateThrust.reset(); this.pirateThrustActive = false; }
      return;
    }
    if (active && !this.pirateThrustActive) {
      this.applyPirateThrustVolume();
      this.pirateThrust.start();
      this.pirateThrustActive = true;
    } else if (!active && this.pirateThrustActive) {
      this.pirateThrust.stop();
      this.pirateThrustActive = false;
    }
  }

  update(): void { this.thrust.update(); this.droneThrust.update(); this.pirateThrust.update(); }

  reset(): void {
    this.thrust.reset();
    this.thrustActive = false;
    this.droneThrust.reset();
    this.droneThrustActive = false;
    this.pirateThrust.reset();
    this.pirateThrustActive = false;
  }

  onLaserShot(): void { this.playOneshot(SfxChannel.LaserShot); }
  onLaserImpact(): void { this.playOneshot(SfxChannel.LaserHit); }
  onAsteroidCollision(): void { this.playOneshot(SfxChannel.AsteroidCollision); }
  onShipCollision(): void { this.playOneshot(SfxChannel.ShipCollision); }
  onCollectable(): void { this.playOneshot(SfxChannel.Collectable); }
  onPirateLaserShot(): void { this.playOneshot(SfxChannel.LaserShot, PIRATE_LASER_VOLUME_SCALE); }
  onPirateCollision(): void { this.playOneshot(SfxChannel.AsteroidCollision, PIRATE_COLLISION_VOLUME_SCALE); }

  private playOneshot(channel: SfxChannel, entityScale = 1): void {
    if (!this.unlocked) return;
    const pool = this.clips[channel];
    if (pool.length === 0) return;
    const clip = pool[Math.floor(this.rng() * pool.length)];
    clip.setVolume(this.volumes.master * this.typeVolume(channel) * entityScale);
    clip.play();
  }

  private typeVolume(channel: SfxChannel): number {
    switch (channel) {
      case SfxChannel.LaserShot: return this.volumes.laserShot;
      case SfxChannel.LaserHit: return this.volumes.laserHit;
      case SfxChannel.AsteroidCollision: return this.volumes.asteroidCollision;
      case SfxChannel.ShipCollision: return this.volumes.shipCollision;
      case SfxChannel.Collectable: return this.volumes.collectable;
      case SfxChannel.Thrust: return this.volumes.thrust;
      default: return 1;
    }
  }

  private applyThrustVolume(): void {
    this.thrust.setVolume(this.volumes.master * this.volumes.thrust);
  }

  private applyDroneThrustVolume(): void {
    this.droneThrust.setVolume(this.volumes.master * this.volumes.thrust * DRONE_THRUST_VOLUME_SCALE);
  }

  private applyPirateThrustVolume(): void {
    this.pirateThrust.setVolume(this.volumes.master * this.volumes.thrust * PIRATE_THRUST_VOLUME_SCALE);
  }

  private attachUnlock(win: Window): void {
    const unlock = (): void => {
      this.unlocked = true;
      win.removeEventListener('pointerdown', unlock);
      win.removeEventListener('keydown', unlock);
    };
    win.addEventListener('pointerdown', unlock);
    win.addEventListener('keydown', unlock);
  }
}

function emptyClips(): Record<SfxChannel, SoundClip[]> {
  return {
    [SfxChannel.Master]: [],
    [SfxChannel.Thrust]: [],
    [SfxChannel.LaserShot]: [],
    [SfxChannel.LaserHit]: [],
    [SfxChannel.AsteroidCollision]: [],
    [SfxChannel.ShipCollision]: [],
    [SfxChannel.Collectable]: [],
  };
}

function clampSettings(settings: SfxSettings): SfxSettings {
  return {
    master: clamp(settings.master, 0, 1),
    thrust: clamp(settings.thrust, 0, 1),
    laserShot: clamp(settings.laserShot, 0, 1),
    laserHit: clamp(settings.laserHit, 0, 1),
    asteroidCollision: clamp(settings.asteroidCollision, 0, 1),
    shipCollision: clamp(settings.shipCollision, 0, 1),
    collectable: clamp(settings.collectable, 0, 1),
  };
}

function folderToChannel(folder: string): SfxChannel | null {
  switch (folder) {
    case 'laser_shot': return SfxChannel.LaserShot;
    case 'laser_hit_asteroid': return SfxChannel.LaserHit;
    case 'asteroid_asteroid_collision': return SfxChannel.AsteroidCollision;
    case 'asteroid_ship_collision': return SfxChannel.ShipCollision;
    case 'collectable': return SfxChannel.Collectable;
    default: return null;
  }
}

class HtmlSoundClip implements SoundClip {
  private readonly audio: HTMLAudioElement;

  constructor(url: string) {
    this.audio = new Audio(url);
    this.audio.preload = 'auto';
    this.audio.volume = 0;
  }

  play(): void {
    this.audio.currentTime = 0;
    void this.audio.play().catch(() => { /* not unlocked yet or interrupted */ });
  }
  stop(): void { this.audio.pause(); }
  setVolume(volume: number): void { this.audio.volume = clamp(volume, 0, 1); }
}

class HtmlThrustAudio implements ThrustAudio {
  private readonly audio: HTMLAudioElement;

  constructor(url: string) {
    this.audio = new Audio(url);
    this.audio.preload = 'auto';
    this.audio.loop = false;
    this.audio.volume = 0;
  }

  get duration(): number { return Number.isFinite(this.audio.duration) ? this.audio.duration : 0; }
  get currentTime(): number { return this.audio.currentTime; }
  get playing(): boolean { return !this.audio.paused && !this.audio.ended; }
  play(): void { void this.audio.play().catch(() => { /* not unlocked yet or interrupted */ }); }
  pause(): void { this.audio.pause(); }
  seek(time: number): void { try { this.audio.currentTime = time; } catch { /* seek out of range */ } }
  setVolume(volume: number): void { this.audio.volume = clamp(volume, 0, 1); }
}

class NullThrustAudio implements ThrustAudio {
  readonly duration = 0;
  readonly currentTime = 0;
  readonly playing = false;
  play(): void {}
  pause(): void {}
  seek(): void {}
  setVolume(): void {}
}
