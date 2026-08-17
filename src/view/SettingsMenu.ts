import type { ControlTuning } from '../types';
import { MUSIC_HYSTERESIS, type MusicThresholds } from './MusicSystem';
import { StorageAdapter } from './StorageAdapter';

const STORAGE_KEY = 'control-tuning';
const MUSIC_STORAGE_KEY = 'music-level';
const MUSIC_THRESHOLD_STORAGE_KEY = 'music-thresholds';
const PARTICLE_STORAGE_KEY = 'particle-visibility';
const DEFAULT_MUSIC_PERCENT = 50;
const DEFAULT_MEDIUM_PERCENT = 25;
const DEFAULT_ACTION_PERCENT = 60;
const DEFAULT_PARTICLE_PERCENT = 100;
const DEFAULT_TUNING: ControlTuning = { dampening: 1.5, thrustAccel: 170, maxSpeed: 650 };

export class SettingsMenu {
  private readonly panel: HTMLElement | null;
  private readonly toggle: HTMLElement | null;
  private readonly dampeningSlider: HTMLInputElement | null;
  private readonly thrustSlider: HTMLInputElement | null;
  private readonly maxSpeedSlider: HTMLInputElement | null;
  private readonly dampeningValue: HTMLElement | null;
  private readonly thrustValue: HTMLElement | null;
  private readonly maxSpeedValue: HTMLElement | null;
  private readonly musicSlider: HTMLInputElement | null;
  private readonly musicValue: HTMLElement | null;
  private readonly mediumSlider: HTMLInputElement | null;
  private readonly mediumValue: HTMLElement | null;
  private readonly actionSlider: HTMLInputElement | null;
  private readonly actionValue: HTMLElement | null;
  private readonly particleSlider: HTMLInputElement | null;
  private readonly particleValue: HTMLElement | null;

  constructor(private readonly storage: StorageAdapter) {
    this.panel = document.querySelector('#settings-panel');
    this.toggle = document.querySelector('#settings-toggle');
    this.dampeningSlider = document.querySelector<HTMLInputElement>('#dampening-slider');
    this.thrustSlider = document.querySelector<HTMLInputElement>('#thrust-slider');
    this.maxSpeedSlider = document.querySelector<HTMLInputElement>('#maxspeed-slider');
    this.dampeningValue = document.querySelector<HTMLElement>('#dampening-value');
    this.thrustValue = document.querySelector<HTMLElement>('#thrust-value');
    this.maxSpeedValue = document.querySelector<HTMLElement>('#maxspeed-value');
    this.musicSlider = document.querySelector<HTMLInputElement>('#music-slider');
    this.musicValue = document.querySelector<HTMLElement>('#music-value');
    this.mediumSlider = document.querySelector<HTMLInputElement>('#medium-slider');
    this.mediumValue = document.querySelector<HTMLElement>('#medium-value');
    this.actionSlider = document.querySelector<HTMLInputElement>('#action-slider');
    this.actionValue = document.querySelector<HTMLElement>('#action-value');
    this.particleSlider = document.querySelector<HTMLInputElement>('#particle-slider');
    this.particleValue = document.querySelector<HTMLElement>('#particle-value');

    const persisted = this.storage.read<Partial<ControlTuning>>(STORAGE_KEY) ?? {};
    this.applyTuning({ ...DEFAULT_TUNING, ...persisted });
    const persistedMusic = this.storage.read<number>(MUSIC_STORAGE_KEY);
    if (persistedMusic != null) this.applyMusic(persistedMusic);
    const persistedThresholds = this.storage.read<{ medium?: number; action?: number }>(MUSIC_THRESHOLD_STORAGE_KEY);
    this.applyThresholds(persistedThresholds?.medium ?? DEFAULT_MEDIUM_PERCENT, persistedThresholds?.action ?? DEFAULT_ACTION_PERCENT);
    const persistedParticle = this.storage.read<number>(PARTICLE_STORAGE_KEY);
    if (persistedParticle != null) this.applyParticle(persistedParticle);

    this.toggle?.addEventListener('click', () => this.togglePanel());
    this.dampeningSlider?.addEventListener('input', () => this.onChange(this.dampeningValue, this.dampeningSlider, 1));
    this.thrustSlider?.addEventListener('input', () => this.onChange(this.thrustValue, this.thrustSlider, 0));
    this.maxSpeedSlider?.addEventListener('input', () => this.onChange(this.maxSpeedValue, this.maxSpeedSlider, 0));
    this.musicSlider?.addEventListener('input', () => this.onMusicChange());
    this.mediumSlider?.addEventListener('input', () => this.onThresholdChange());
    this.actionSlider?.addEventListener('input', () => this.onThresholdChange());
    this.particleSlider?.addEventListener('input', () => this.onParticleChange());
  }

  getControlTuning(): ControlTuning {
    return {
      dampening: this.read(this.dampeningSlider, DEFAULT_TUNING.dampening),
      thrustAccel: this.read(this.thrustSlider, DEFAULT_TUNING.thrustAccel),
      maxSpeed: this.read(this.maxSpeedSlider, DEFAULT_TUNING.maxSpeed),
    };
  }

  getMusicLevel(): number {
    const raw = Number(this.musicSlider?.value);
    const percent = Number.isFinite(raw) ? raw : DEFAULT_MUSIC_PERCENT;
    return Math.max(0, Math.min(1, percent / 100));
  }

  getMusicThresholds(): MusicThresholds {
    const medium = this.percent(this.mediumSlider, DEFAULT_MEDIUM_PERCENT);
    let action = this.percent(this.actionSlider, DEFAULT_ACTION_PERCENT);
    action = Math.max(action, Math.min(1, medium + MUSIC_HYSTERESIS));
    return { medium, action };
  }

  getParticleVisibility(): number {
    const raw = Number(this.particleSlider?.value);
    const percent = Number.isFinite(raw) ? raw : DEFAULT_PARTICLE_PERCENT;
    return Math.max(0, Math.min(1, percent / 100));
  }

  private applyTuning(tuning: ControlTuning): void {
    if (this.dampeningSlider) this.dampeningSlider.value = String(tuning.dampening);
    if (this.thrustSlider) this.thrustSlider.value = String(tuning.thrustAccel);
    if (this.maxSpeedSlider) this.maxSpeedSlider.value = String(tuning.maxSpeed);
    this.syncLabel(this.dampeningValue, this.dampeningSlider, 1);
    this.syncLabel(this.thrustValue, this.thrustSlider, 0);
    this.syncLabel(this.maxSpeedValue, this.maxSpeedSlider, 0);
  }

  private applyMusic(percent: number): void {
    const clamped = String(Math.max(0, Math.min(100, Math.round(percent))));
    if (this.musicSlider) this.musicSlider.value = clamped;
    if (this.musicValue) this.musicValue.textContent = clamped;
  }

  private applyThresholds(mediumPercent: number, actionPercent: number): void {
    const medium = String(Math.max(0, Math.min(100, Math.round(mediumPercent))));
    const action = String(Math.max(0, Math.min(100, Math.round(actionPercent))));
    if (this.mediumSlider) this.mediumSlider.value = medium;
    if (this.mediumValue) this.mediumValue.textContent = medium;
    if (this.actionSlider) this.actionSlider.value = action;
    if (this.actionValue) this.actionValue.textContent = action;
  }

  private applyParticle(percent: number): void {
    const clamped = String(Math.max(0, Math.min(100, Math.round(percent))));
    if (this.particleSlider) this.particleSlider.value = clamped;
    if (this.particleValue) this.particleValue.textContent = clamped;
  }

  private togglePanel(): void { this.panel?.classList.toggle('hidden'); }

  private onChange(label: HTMLElement | null, slider: HTMLInputElement | null, digits: number): void {
    this.syncLabel(label, slider, digits);
    this.storage.write(STORAGE_KEY, this.getControlTuning());
  }

  private onMusicChange(): void {
    if (this.musicValue && this.musicSlider) this.musicValue.textContent = this.musicSlider.value;
    this.storage.write(MUSIC_STORAGE_KEY, Number(this.musicSlider?.value));
  }

  private onThresholdChange(): void {
    if (this.mediumValue && this.mediumSlider) this.mediumValue.textContent = this.mediumSlider.value;
    if (this.actionValue && this.actionSlider) this.actionValue.textContent = this.actionSlider.value;
    this.storage.write(MUSIC_THRESHOLD_STORAGE_KEY, {
      medium: Number(this.mediumSlider?.value),
      action: Number(this.actionSlider?.value),
    });
  }

  private onParticleChange(): void {
    if (this.particleValue && this.particleSlider) this.particleValue.textContent = this.particleSlider.value;
    this.storage.write(PARTICLE_STORAGE_KEY, Number(this.particleSlider?.value));
  }

  private read(slider: HTMLInputElement | null, fallback: number): number {
    const value = Number(slider?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  private percent(slider: HTMLInputElement | null, fallbackPercent: number): number {
    const raw = Number(slider?.value);
    const value = Number.isFinite(raw) ? raw : fallbackPercent;
    return Math.max(0, Math.min(1, value / 100));
  }

  private syncLabel(label: HTMLElement | null, slider: HTMLInputElement | null, digits: number): void {
    if (label && slider) label.textContent = Number(slider.value).toFixed(digits);
  }
}
