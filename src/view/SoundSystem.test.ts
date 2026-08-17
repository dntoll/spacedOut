import { describe, expect, it } from 'vitest';
import { DEFAULT_SFX_SETTINGS, SoundSystem, type SoundClip, SfxChannel } from './SoundSystem';
import { ThrustSound, type ThrustAudio } from './ThrustSound';

class FakeSoundClip implements SoundClip {
  volume = -1;
  plays = 0;
  stops = 0;
  play(): void { this.plays++; }
  stop(): void { this.stops++; }
  setVolume(volume: number): void { this.volume = volume; }
}

class FakeThrustAudio implements ThrustAudio {
  duration = 10;
  currentTime = 0;
  playing = false;
  volume = 0;
  play(): void { this.playing = true; }
  pause(): void { this.playing = false; }
  seek(time: number): void { this.currentTime = time; }
  setVolume(volume: number): void { this.volume = volume; }
  tick(dt: number): void {
    if (!this.playing) return;
    this.currentTime += dt;
    if (this.currentTime >= this.duration) { this.currentTime = this.duration; this.playing = false; }
  }
}

interface Harness {
  system: SoundSystem;
  audio: FakeThrustAudio;
  thrust: ThrustSound;
}

function harness(clips: Partial<Record<SfxChannel, SoundClip[]>>, rng: () => number = () => 0): Harness {
  const audio = new FakeThrustAudio();
  const thrust = new ThrustSound(audio, { startFraction: 0.1, endFraction: 0.1 });
  const system = new SoundSystem(clips, thrust, { rng });
  return { system, audio, thrust };
}

const fullSettings = (overrides: Partial<typeof DEFAULT_SFX_SETTINGS> = {}) => ({ ...DEFAULT_SFX_SETTINGS, ...overrides });

describe('SoundSystem', () => {
  it('REQ-45 stays silent until unlocked', () => {
    const clip = new FakeSoundClip();
    const { system, thrust } = harness({ [SfxChannel.LaserShot]: [clip] });

    system.onLaserShot();
    system.setThrusting(true);

    expect(clip.plays).toBe(0);
    expect(thrust.currentPhase).toBe('idle');
  });

  it('REQ-45 plays a laser-shot variation on firing after unlock', () => {
    const clip = new FakeSoundClip();
    const { system } = harness({ [SfxChannel.LaserShot]: [clip] });
    system.unlock();

    system.onLaserShot();

    expect(clip.plays).toBe(1);
  });

  it('REQ-45 scales one-shot volume by the master and per-type sliders', () => {
    const clip = new FakeSoundClip();
    const { system } = harness({ [SfxChannel.LaserShot]: [clip] });
    system.unlock();
    system.setSettings(fullSettings({ master: 0.5, laserShot: 0.8 }));

    system.onLaserShot();

    expect(clip.volume).toBeCloseTo(0.4, 5);
  });

  it('REQ-45 selects a random variation per event', () => {
    const clips = [new FakeSoundClip(), new FakeSoundClip(), new FakeSoundClip(), new FakeSoundClip()];
    const { system } = harness({ [SfxChannel.LaserShot]: clips }, () => 0.5);
    system.unlock();

    system.onLaserShot();

    expect(clips[2].plays).toBe(1);
    expect(clips.filter((c) => c.plays === 0)).toHaveLength(3);
  });

  it('REQ-45 routes each event to its own effect type', () => {
    const laser = new FakeSoundClip();
    const hit = new FakeSoundClip();
    const rock = new FakeSoundClip();
    const ship = new FakeSoundClip();
    const pickup = new FakeSoundClip();
    const { system } = harness({
      [SfxChannel.LaserShot]: [laser],
      [SfxChannel.LaserHit]: [hit],
      [SfxChannel.AsteroidCollision]: [rock],
      [SfxChannel.ShipCollision]: [ship],
      [SfxChannel.Collectable]: [pickup],
    });
    system.unlock();

    system.onLaserShot();
    system.onLaserImpact();
    system.onAsteroidCollision();
    system.onShipCollision();
    system.onCollectable();

    expect(laser.plays).toBe(1);
    expect(hit.plays).toBe(1);
    expect(rock.plays).toBe(1);
    expect(ship.plays).toBe(1);
    expect(pickup.plays).toBe(1);
  });

  it('REQ-45 plays a collectable-pickup variation on collection after unlock', () => {
    const clip = new FakeSoundClip();
    const { system } = harness({ [SfxChannel.Collectable]: [clip] });
    system.unlock();

    system.onCollectable();

    expect(clip.plays).toBe(1);
  });

  it('REQ-45 scales the collectable-pickup volume by the master and per-type sliders', () => {
    const clip = new FakeSoundClip();
    const { system } = harness({ [SfxChannel.Collectable]: [clip] });
    system.unlock();
    system.setSettings(fullSettings({ master: 0.5, collectable: 0.8 }));

    system.onCollectable();

    expect(clip.volume).toBeCloseTo(0.4, 5);
  });

  it('REQ-45 starts the thrust start segment when thrust begins', () => {
    const { system, audio, thrust } = harness({});
    system.unlock();

    system.setThrusting(true);

    expect(thrust.currentPhase).toBe('starting');
    expect(audio.playing).toBe(true);
  });

  it('REQ-45 scales thrust volume by the master and thrust sliders', () => {
    const { system, audio } = harness({});
    system.unlock();
    system.setSettings(fullSettings({ master: 0.5, thrust: 0.8 }));

    system.setThrusting(true);

    expect(audio.volume).toBeCloseTo(0.4, 5);
  });

  it('REQ-45 updates the live thrust volume when settings change', () => {
    const { system, audio } = harness({});
    system.unlock();
    system.setThrusting(true);
    expect(audio.volume).toBeCloseTo(1, 5);

    system.setSettings(fullSettings({ master: 0.2 }));

    expect(audio.volume).toBeCloseTo(0.2, 5);
  });

  it('REQ-45 progresses through start, loop, and end as thrust starts and stops', () => {
    const { system, audio, thrust } = harness({});
    system.unlock();
    system.setThrusting(true);

    audio.tick(2); system.update();
    expect(thrust.currentPhase).toBe('looping');

    system.setThrusting(false);
    expect(thrust.currentPhase).toBe('ending');

    audio.tick(2); system.update();
    expect(thrust.currentPhase).toBe('idle');
    expect(audio.playing).toBe(false);
  });

  it('REQ-45 does not double-start thrust when already thrusting', () => {
    const { system, thrust } = harness({});
    system.unlock();
    system.setThrusting(true);
    system.setThrusting(true);

    expect(thrust.currentPhase).toBe('starting');
  });

  it('REQ-45 reset stops the thrust sound immediately', () => {
    const { system, audio, thrust } = harness({});
    system.unlock();
    system.setThrusting(true);
    audio.tick(2); system.update();

    system.reset();

    expect(thrust.currentPhase).toBe('idle');
    expect(audio.playing).toBe(false);
  });
});
