import { describe, expect, it } from 'vitest';
import { MusicSystem, type AudioTrack, type FlightSignals, type MusicCategory } from './MusicSystem';

class FakeTrack implements AudioTrack {
  readonly category: MusicCategory;
  readonly duration = 120;
  volume = 0;
  playing = false;
  ended = false;
  private t = 0;

  constructor(category: MusicCategory) { this.category = category; }

  get currentTime(): number { return this.t; }
  set currentTime(value: number) { this.t = value; this.ended = false; }
  play(): void { this.playing = true; }
  pause(): void { this.playing = false; }
}

function tracks(...categories: MusicCategory[]): FakeTrack[] {
  return categories.map((c) => new FakeTrack(c));
}

function sig(thrust: number, turn: number, firing = 0): FlightSignals {
  return { thrust, turn, firing };
}

const IDLE = sig(0, 0);
const TURN_REF = 6;
const DT = 0.1;

function turn(rate: number): number { return rate * TURN_REF; }

function hold(system: MusicSystem, signals: FlightSignals, level: number, seconds: number): void {
  const steps = Math.max(1, Math.round(seconds / DT));
  for (let i = 0; i < steps; i++) system.update(signals, level, DT);
}

describe('MusicSystem', () => {
  it('REQ-29 stays silent until unlocked', () => {
    const calm = tracks('calm');
    const system = new MusicSystem(calm, { fadeSeconds: 1, decaySeconds: 3 });

    system.update(IDLE, 1, 1);

    expect(calm[0].playing).toBe(false);
    expect(system.activeCategory).toBeNull();
  });

  it('REQ-29 selects calm when the ship is idle', () => {
    const calm = tracks('calm', 'calm');
    const medium = tracks('medium', 'medium');
    const action = tracks('action', 'action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, decaySeconds: 3 });
    system.unlock();

    hold(system, IDLE, 1, 1);

    expect(system.activeCategory).toBe('calm');
    expect(calm[0].playing).toBe(true);
    expect(medium[0].playing).toBe(false);
    expect(action[0].playing).toBe(false);
  });

  it('REQ-29 builds intensity from sustained thrust up to a medium equilibrium', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, decaySeconds: 3 });
    system.unlock();
    hold(system, IDLE, 1, 1);

    hold(system, sig(1, 0), 1, 10); // equilibrium ~0.1*3 = 0.3 -> medium

    expect(system.intensity).toBeGreaterThanOrEqual(0.25);
    expect(system.intensity).toBeLessThan(0.6);
    expect(system.activeCategory).toBe('medium');
  });

  it('REQ-29 reaches action under full thrust, hard turning, and firing', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, decaySeconds: 3 });
    system.unlock();
    hold(system, IDLE, 1, 1);

    hold(system, sig(1, turn(1), 5), 1, 30); // equilibrium ~0.61 -> action

    expect(system.intensity).toBeGreaterThanOrEqual(0.6);
    expect(system.activeCategory).toBe('action');
    expect(action[0].playing).toBe(true);
  });

  it('REQ-29 ignores turning when the ship is not thrusting', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, decaySeconds: 3 });
    system.unlock();
    hold(system, IDLE, 1, 1);

    hold(system, sig(0, turn(1)), 1, 5); // turning alone charges nothing

    expect(system.intensity).toBeLessThan(0.25);
    expect(system.activeCategory).toBe('calm');
  });

  it('REQ-29 counts laser firing toward the intensity sum', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, decaySeconds: 3 });
    system.unlock();
    hold(system, IDLE, 1, 1);

    hold(system, sig(0.5, 0, 0), 1, 10);
    const cruising = system.intensity;

    hold(system, sig(0.5, 0, 5), 1, 10);
    const firing = system.intensity;

    expect(firing).toBeGreaterThan(cruising);
  });

  it('REQ-29 decays the intensity sum toward zero when actions stop', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 1, decaySeconds: 3 });
    system.unlock();
    hold(system, sig(1, 0), 1, 10);
    const elevated = system.intensity;
    expect(elevated).toBeGreaterThan(0.2);

    hold(system, IDLE, 1, 30); // ~10 time constants -> ~0

    expect(system.intensity).toBeLessThan(0.01);
    expect(system.activeCategory).toBe('calm');
  });

  it('REQ-29 lets the decay rate control how fast intensity bleeds off', () => {
    const fast = new MusicSystem(tracks('medium'), { fadeSeconds: 1, decaySeconds: 1 });
    const slow = new MusicSystem(tracks('medium'), { fadeSeconds: 1, decaySeconds: 6 });
    fast.unlock(); slow.unlock();
    fast.recordExplosion();
    slow.recordExplosion();
    const startFast = fast.intensity;
    const startSlow = slow.intensity;

    hold(fast, IDLE, 1, 3);
    hold(slow, IDLE, 1, 3);

    expect(fast.intensity).toBeLessThan(startFast * 0.1);
    expect(slow.intensity).toBeGreaterThan(startSlow * 0.3);
  });

  it('REQ-29 spikes on hits, damage, and explosions', () => {
    const system = new MusicSystem(tracks('medium', 'action'), { fadeSeconds: 1, decaySeconds: 30 });
    system.unlock();

    system.update(IDLE, 1, DT);
    const baseline = system.intensity;

    system.recordLaserImpact();
    const afterLaser = system.intensity;
    expect(afterLaser).toBeGreaterThan(baseline);

    system.recordExplosion();
    const afterExplosion = system.intensity;
    expect(afterExplosion).toBeGreaterThan(afterLaser);

    system.recordShipDamage();
    const afterDamage = system.intensity;
    expect(afterDamage).toBeGreaterThan(afterExplosion);
  });

  it('REQ-29 orders event spikes: damage > explosion > laser-hit', () => {
    const d = new MusicSystem(tracks('medium'), { fadeSeconds: 1, decaySeconds: 1000 });
    const e = new MusicSystem(tracks('medium'), { fadeSeconds: 1, decaySeconds: 1000 });
    const l = new MusicSystem(tracks('medium'), { fadeSeconds: 1, decaySeconds: 1000 });

    d.recordShipDamage();
    e.recordExplosion();
    l.recordLaserImpact();

    expect(d.intensity).toBeGreaterThan(e.intensity);
    expect(e.intensity).toBeGreaterThan(l.intensity);
  });

  it('REQ-29 crosses category boundaries on the tunable thresholds', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const action = tracks('action');
    const system = new MusicSystem([...calm, ...medium, ...action], { fadeSeconds: 1, decaySeconds: 1000 });
    system.unlock();
    system.setThresholds({ medium: 0.25, action: 0.6 });
    system.update(IDLE, 1, DT); // unlock-activate calm

    system.recordLaserImpact(); // +0.08 -> ~0.08, still calm
    system.update(IDLE, 1, DT);
    expect(system.activeCategory).toBe('calm');

    system.recordShipDamage(); // +0.3 -> ~0.38, medium
    system.update(IDLE, 1, DT);
    expect(system.activeCategory).toBe('medium');

    system.recordShipDamage(); // +0.3 -> ~0.68, action
    system.update(IDLE, 1, DT);
    expect(system.activeCategory).toBe('action');
  });

  it('REQ-29 crossfades between categories when the intensity changes', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 1, decaySeconds: 1000 });
    system.unlock();
    hold(system, IDLE, 1, 1);
    expect(calm[0].volume).toBeCloseTo(1, 5);

    system.recordShipDamage(); // jump into medium
    system.update(sig(1, 0), 1, 0.5); // halfway crossfade
    expect(calm[0].volume).toBeCloseTo(0.5, 5);
    expect(medium[0].volume).toBeCloseTo(0.5, 5);
    expect(calm[0].playing).toBe(true);
    expect(medium[0].playing).toBe(true);

    system.update(sig(1, 0), 1, 0.5); // finish crossfade
    expect(calm[0].volume).toBeCloseTo(0, 5);
    expect(medium[0].volume).toBeCloseTo(1, 5);
    expect(calm[0].playing).toBe(false);
    expect(medium[0].playing).toBe(true);
  });

  it('REQ-29 rotates to the next track when the current song ends', () => {
    const calm = tracks('calm', 'calm');
    const system = new MusicSystem(calm, { fadeSeconds: 1, decaySeconds: 3 });
    system.unlock();
    hold(system, IDLE, 1, 1);
    expect(calm[0].playing).toBe(true);

    calm[0].ended = true;
    system.update(IDLE, 1, 0.1);

    expect(calm[0].currentTime).toBe(0);
    expect(calm[0].playing).toBe(false);
    expect(calm[1].playing).toBe(true);
  });

  it('REQ-29 resumes a paused track from its remembered position', () => {
    const calm = tracks('calm');
    const medium = tracks('medium');
    const system = new MusicSystem([...calm, ...medium], { fadeSeconds: 0.5, decaySeconds: 3 });
    system.unlock();
    hold(system, IDLE, 1, 1);
    calm[0].currentTime = 30;

    system.recordShipDamage(); // jump to medium
    hold(system, sig(1, 0), 1, 1); // switch to medium, calm fades out and pauses
    expect(calm[0].playing).toBe(false);
    expect(calm[0].currentTime).toBe(30);

    hold(system, IDLE, 1, 6); // decay back below the medium threshold -> calm
    expect(system.activeCategory).toBe('calm');
    expect(calm[0].playing).toBe(true);
    expect(calm[0].currentTime).toBe(30);
  });

  it('REQ-19 REQ-29 fades to silence when the music level is zero', () => {
    const calm = tracks('calm');
    const system = new MusicSystem(calm, { fadeSeconds: 1, decaySeconds: 3 });
    system.unlock();
    hold(system, IDLE, 1, 1);
    expect(calm[0].volume).toBeCloseTo(1, 5);

    hold(system, IDLE, 0, 2);
    expect(calm[0].volume).toBeCloseTo(0, 5);
    expect(calm[0].playing).toBe(false);
  });
});
