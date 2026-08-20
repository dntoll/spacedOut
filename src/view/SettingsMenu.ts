import type { ControlTuning } from '../types';
import { SfxChannel, type SfxSettings } from './SoundSystem';
import { StorageAdapter } from './StorageAdapter';

const STORAGE_KEY = 'control-tuning';
const MUSIC_STORAGE_KEY = 'music-level';
const PARTICLE_STORAGE_KEY = 'particle-visibility';
const SFX_STORAGE_KEY = 'sfx-settings';
const ZOOM_STORAGE_KEY = 'default-zoom';
const LAMP_STORAGE_KEY = 'lamp-radius';
const DEFAULT_MUSIC_PERCENT = 50;
const DEFAULT_PARTICLE_PERCENT = 40;
const DEFAULT_ZOOM = 1.15;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const DEFAULT_LAMP_RADIUS = 450;
const LAMP_MIN = 150;
const LAMP_MAX = 1200;
const DEFAULT_TUNING: ControlTuning = { dampening: 2, thrustAccel: 500, maxSpeed: 1000 };
const DEFAULT_SFX_PERCENTS: Record<SfxChannel, number> = {
  [SfxChannel.Master]: 60,
  [SfxChannel.Thrust]: 46,
  [SfxChannel.LaserShot]: 50,
  [SfxChannel.LaserHit]: 61,
  [SfxChannel.AsteroidCollision]: 42,
  [SfxChannel.ShipCollision]: 100,
  [SfxChannel.Collectable]: 100,
};

interface SfxSliderConfig {
  channel: SfxChannel;
  field: keyof SfxSettings;
  sliderId: string;
  valueId: string;
}

const SFX_SLIDERS: readonly SfxSliderConfig[] = [
  { channel: SfxChannel.Master, field: 'master', sliderId: 'sfx-master-slider', valueId: 'sfx-master-value' },
  { channel: SfxChannel.Thrust, field: 'thrust', sliderId: 'sfx-thrust-slider', valueId: 'sfx-thrust-value' },
  { channel: SfxChannel.LaserShot, field: 'laserShot', sliderId: 'sfx-laser-slider', valueId: 'sfx-laser-value' },
  { channel: SfxChannel.LaserHit, field: 'laserHit', sliderId: 'sfx-laser-hit-slider', valueId: 'sfx-laser-hit-value' },
  { channel: SfxChannel.AsteroidCollision, field: 'asteroidCollision', sliderId: 'sfx-asteroid-slider', valueId: 'sfx-asteroid-value' },
  { channel: SfxChannel.ShipCollision, field: 'shipCollision', sliderId: 'sfx-ship-slider', valueId: 'sfx-ship-value' },
  { channel: SfxChannel.Collectable, field: 'collectable', sliderId: 'sfx-collectable-slider', valueId: 'sfx-collectable-value' },
];

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
  private readonly particleSlider: HTMLInputElement | null;
  private readonly particleValue: HTMLElement | null;
  private readonly zoomSlider: HTMLInputElement | null;
  private readonly zoomValue: HTMLElement | null;
  private readonly lampSlider: HTMLInputElement | null;
  private readonly lampValue: HTMLElement | null;
  private readonly sfxSliders = new Map<SfxChannel, HTMLInputElement | null>();
  private readonly sfxValues = new Map<SfxChannel, HTMLElement | null>();
  private readonly devSection: HTMLElement | null;

  constructor(private readonly storage: StorageAdapter, private readonly dev: boolean = import.meta.env.DEV) {
    this.panel = document.querySelector('#settings-panel');
    this.toggle = document.querySelector('#settings-toggle');
    this.devSection = document.querySelector<HTMLElement>('#settings-dev');
    this.dampeningSlider = document.querySelector<HTMLInputElement>('#dampening-slider');
    this.thrustSlider = document.querySelector<HTMLInputElement>('#thrust-slider');
    this.maxSpeedSlider = document.querySelector<HTMLInputElement>('#maxspeed-slider');
    this.dampeningValue = document.querySelector<HTMLElement>('#dampening-value');
    this.thrustValue = document.querySelector<HTMLElement>('#thrust-value');
    this.maxSpeedValue = document.querySelector<HTMLElement>('#maxspeed-value');
    this.musicSlider = document.querySelector<HTMLInputElement>('#music-slider');
    this.musicValue = document.querySelector<HTMLElement>('#music-value');
    this.particleSlider = document.querySelector<HTMLInputElement>('#particle-slider');
    this.particleValue = document.querySelector<HTMLElement>('#particle-value');
    this.zoomSlider = document.querySelector<HTMLInputElement>('#zoom-slider');
    this.zoomValue = document.querySelector<HTMLElement>('#zoom-value');
    this.lampSlider = document.querySelector<HTMLInputElement>('#lamp-slider');
    this.lampValue = document.querySelector<HTMLElement>('#lamp-value');
    for (const cfg of SFX_SLIDERS) {
      this.sfxSliders.set(cfg.channel, document.querySelector<HTMLInputElement>(`#${cfg.sliderId}`));
      this.sfxValues.set(cfg.channel, document.querySelector<HTMLElement>(`#${cfg.valueId}`));
    }

    const persisted = this.storage.read<Partial<ControlTuning>>(STORAGE_KEY) ?? {};
    this.applyTuning({ ...DEFAULT_TUNING, ...persisted });
    const persistedMusic = this.storage.read<number>(MUSIC_STORAGE_KEY);
    if (persistedMusic != null) this.applyMusic(persistedMusic);
    const persistedParticle = this.storage.read<number>(PARTICLE_STORAGE_KEY);
    if (persistedParticle != null) this.applyParticle(persistedParticle);
    const persistedZoom = this.storage.read<number>(ZOOM_STORAGE_KEY);
    if (persistedZoom != null) this.applyZoom(persistedZoom);
    const persistedLamp = this.storage.read<number>(LAMP_STORAGE_KEY);
    if (persistedLamp != null) this.applyLamp(persistedLamp);
    const persistedSfx = this.storage.read<Partial<Record<keyof SfxSettings, number>>>(SFX_STORAGE_KEY) ?? {};
    this.applySfx(persistedSfx);

    if (this.dev) this.devSection?.classList.remove('hidden');

    this.toggle?.addEventListener('click', () => this.togglePanel());
    this.dampeningSlider?.addEventListener('input', () => this.onChange(this.dampeningValue, this.dampeningSlider, 1));
    this.thrustSlider?.addEventListener('input', () => this.onChange(this.thrustValue, this.thrustSlider, 0));
    this.maxSpeedSlider?.addEventListener('input', () => this.onChange(this.maxSpeedValue, this.maxSpeedSlider, 0));
    this.musicSlider?.addEventListener('input', () => this.onMusicChange());
    this.particleSlider?.addEventListener('input', () => this.onParticleChange());
    this.zoomSlider?.addEventListener('input', () => this.onZoomChange());
    this.lampSlider?.addEventListener('input', () => this.onLampChange());
    for (const cfg of SFX_SLIDERS) {
      this.sfxSliders.get(cfg.channel)?.addEventListener('input', () => this.onSfxChange());
    }
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

  getParticleVisibility(): number {
    const raw = Number(this.particleSlider?.value);
    const percent = Number.isFinite(raw) ? raw : DEFAULT_PARTICLE_PERCENT;
    return Math.max(0, Math.min(1, percent / 100));
  }

  getDefaultZoomLevel(): number {
    const raw = Number(this.zoomSlider?.value);
    const value = Number.isFinite(raw) ? raw : DEFAULT_ZOOM;
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
  }

  getLampRadius(): number {
    const raw = Number(this.lampSlider?.value);
    const value = Number.isFinite(raw) ? raw : DEFAULT_LAMP_RADIUS;
    return Math.max(LAMP_MIN, Math.min(LAMP_MAX, value));
  }

  getSfxSettings(): SfxSettings {
    return {
      master: this.sfxFraction(SfxChannel.Master),
      thrust: this.sfxFraction(SfxChannel.Thrust),
      laserShot: this.sfxFraction(SfxChannel.LaserShot),
      laserHit: this.sfxFraction(SfxChannel.LaserHit),
      asteroidCollision: this.sfxFraction(SfxChannel.AsteroidCollision),
      shipCollision: this.sfxFraction(SfxChannel.ShipCollision),
      collectable: this.sfxFraction(SfxChannel.Collectable),
    };
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

  private applyParticle(percent: number): void {
    const clamped = String(Math.max(0, Math.min(100, Math.round(percent))));
    if (this.particleSlider) this.particleSlider.value = clamped;
    if (this.particleValue) this.particleValue.textContent = clamped;
  }

  private applyZoom(value: number): void {
    let clamped = Number(value);
    if (!Number.isFinite(clamped)) clamped = DEFAULT_ZOOM;
    clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, clamped));
    const text = clamped.toFixed(2);
    if (this.zoomSlider) this.zoomSlider.value = text;
    if (this.zoomValue) this.zoomValue.textContent = text;
  }

  private applyLamp(value: number): void {
    let clamped = Number(value);
    if (!Number.isFinite(clamped)) clamped = DEFAULT_LAMP_RADIUS;
    clamped = Math.max(LAMP_MIN, Math.min(LAMP_MAX, Math.round(clamped)));
    const text = String(clamped);
    if (this.lampSlider) this.lampSlider.value = text;
    if (this.lampValue) this.lampValue.textContent = text;
  }

  private applySfx(percents: Partial<Record<keyof SfxSettings, number>>): void {
    for (const cfg of SFX_SLIDERS) {
      const fallback = DEFAULT_SFX_PERCENTS[cfg.channel];
      const stored = percents[cfg.field];
      let percent = stored != null ? Number(stored) : fallback;
      if (!Number.isFinite(percent)) percent = fallback;
      const clamped = String(Math.max(0, Math.min(100, Math.round(percent))));
      const slider = this.sfxSliders.get(cfg.channel);
      const value = this.sfxValues.get(cfg.channel);
      if (slider) slider.value = clamped;
      if (value) value.textContent = clamped;
    }
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

  private onParticleChange(): void {
    if (this.particleValue && this.particleSlider) this.particleValue.textContent = this.particleSlider.value;
    this.storage.write(PARTICLE_STORAGE_KEY, Number(this.particleSlider?.value));
  }

  private onZoomChange(): void {
    this.syncLabel(this.zoomValue, this.zoomSlider, 2);
    this.storage.write(ZOOM_STORAGE_KEY, Number(this.zoomSlider?.value));
  }

  private onLampChange(): void {
    if (this.lampValue && this.lampSlider) this.lampValue.textContent = this.lampSlider.value;
    this.storage.write(LAMP_STORAGE_KEY, Number(this.lampSlider?.value));
  }

  private onSfxChange(): void {
    for (const cfg of SFX_SLIDERS) {
      const slider = this.sfxSliders.get(cfg.channel);
      const value = this.sfxValues.get(cfg.channel);
      if (value && slider) value.textContent = slider.value;
    }
    const percents: Record<string, number> = {};
    for (const cfg of SFX_SLIDERS) percents[cfg.field] = Number(this.sfxSliders.get(cfg.channel)?.value);
    this.storage.write(SFX_STORAGE_KEY, percents);
  }

  private read(slider: HTMLInputElement | null, fallback: number): number {
    const value = Number(slider?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  private sfxFraction(channel: SfxChannel): number {
    const raw = Number(this.sfxSliders.get(channel)?.value);
    const percent = Number.isFinite(raw) ? raw : DEFAULT_SFX_PERCENTS[channel];
    return Math.max(0, Math.min(1, percent / 100));
  }

  private syncLabel(label: HTMLElement | null, slider: HTMLInputElement | null, digits: number): void {
    if (label && slider) label.textContent = Number(slider.value).toFixed(digits);
  }
}
