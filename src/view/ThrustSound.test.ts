import { describe, expect, it } from 'vitest';
import { DEFAULT_THRUST_SPLITS, ThrustSound, type ThrustAudio } from './ThrustSound';

class FakeThrustAudio implements ThrustAudio {
  duration: number;
  currentTime = 0;
  playing = false;
  volume = 0;
  readonly seekCalls: number[] = [];
  constructor(duration: number) { this.duration = duration; }
  play(): void { this.playing = true; }
  pause(): void { this.playing = false; }
  seek(time: number): void { this.currentTime = time; this.seekCalls.push(time); }
  setVolume(v: number): void { this.volume = v; }
  tick(dt: number): void {
    if (!this.playing) return;
    this.currentTime += dt;
    if (this.currentTime >= this.duration) { this.currentTime = this.duration; this.playing = false; }
  }
}

const splits = { startFraction: 0.1, endFraction: 0.1 };
const DURATION = 10;
const LOOP_START = 1;
const LOOP_END = 9;

function makeThrust(duration = DURATION): { audio: FakeThrustAudio; thrust: ThrustSound } {
  const audio = new FakeThrustAudio(duration);
  const thrust = new ThrustSound(audio, splits);
  return { audio, thrust };
}

describe('ThrustSound', () => {
  it('REQ-45 plays the start segment from the beginning when thrust begins', () => {
    const { audio, thrust } = makeThrust();

    thrust.start();

    expect(audio.playing).toBe(true);
    expect(audio.currentTime).toBe(0);
    expect(thrust.currentPhase).toBe('starting');
  });

  it('REQ-45 does not retrigger start while already thrusting', () => {
    const { audio, thrust } = makeThrust();

    thrust.start();
    thrust.start();

    expect(audio.seekCalls.filter((t) => t === 0)).toHaveLength(1);
    expect(thrust.currentPhase).toBe('starting');
  });

  it('REQ-45 transitions into the loop segment once the start segment finishes', () => {
    const { audio, thrust } = makeThrust();
    thrust.start();

    audio.tick(0.5); thrust.update();
    expect(thrust.currentPhase).toBe('starting');

    audio.tick(0.6); thrust.update(); // 1.1 >= loopStart
    expect(thrust.currentPhase).toBe('looping');
    expect(audio.currentTime).toBeCloseTo(LOOP_START, 5);
  });

  it('REQ-45 repeats the loop segment while thrusting', () => {
    const { audio, thrust } = makeThrust();
    thrust.start();
    audio.tick(1.5); thrust.update(); // into looping at loopStart

    audio.tick(8.5); thrust.update(); // 9.5 >= loopEnd -> seek back to loopStart
    expect(thrust.currentPhase).toBe('looping');
    expect(audio.currentTime).toBeCloseTo(LOOP_START, 5);
  });

  it('REQ-45 plays the end segment when thrust stops, then returns to idle', () => {
    const { audio, thrust } = makeThrust();
    thrust.start();
    audio.tick(2); thrust.update(); // looping

    thrust.stop();
    expect(thrust.currentPhase).toBe('ending');
    expect(audio.currentTime).toBeCloseTo(LOOP_END, 5);
    expect(audio.playing).toBe(true);

    audio.tick(1.5); thrust.update(); // reaches the end of the file
    expect(thrust.currentPhase).toBe('idle');
    expect(audio.playing).toBe(false);
  });

  it('REQ-45 jumps to the end segment when stopping during the start segment', () => {
    const { audio, thrust } = makeThrust();
    thrust.start();
    audio.tick(0.3); thrust.update(); // still starting

    thrust.stop();
    expect(thrust.currentPhase).toBe('ending');
    expect(audio.currentTime).toBeCloseTo(LOOP_END, 5);
  });

  it('REQ-45 ignores stop when already idle', () => {
    const { thrust } = makeThrust();

    thrust.stop();

    expect(thrust.currentPhase).toBe('idle');
  });

  it('REQ-45 falls back to idle when stopping before the duration is known', () => {
    const { audio, thrust } = makeThrust(NaN);
    thrust.start();

    thrust.stop();

    expect(thrust.currentPhase).toBe('idle');
    expect(audio.playing).toBe(false);
  });

  it('REQ-45 reset stops playback immediately and returns to idle', () => {
    const { audio, thrust } = makeThrust();
    thrust.start();
    audio.tick(2); thrust.update(); // looping

    thrust.reset();

    expect(thrust.currentPhase).toBe('idle');
    expect(audio.playing).toBe(false);
  });

  it('REQ-45 setVolume scales and clamps the thrust volume', () => {
    const { audio, thrust } = makeThrust();

    thrust.setVolume(0.4);
    expect(audio.volume).toBeCloseTo(0.4, 5);
    expect(thrust.currentVolume).toBeCloseTo(0.4, 5);

    thrust.setVolume(2);
    expect(audio.volume).toBe(1);
    thrust.setVolume(-1);
    expect(audio.volume).toBe(0);
  });

  it('REQ-45 exposes sensible default split fractions', () => {
    expect(DEFAULT_THRUST_SPLITS.startFraction).toBeGreaterThan(0);
    expect(DEFAULT_THRUST_SPLITS.endFraction).toBeGreaterThan(0);
    expect(DEFAULT_THRUST_SPLITS.startFraction + DEFAULT_THRUST_SPLITS.endFraction).toBeLessThan(1);
  });
});
