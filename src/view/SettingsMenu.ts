import type { ControlTuning } from '../types';

export class SettingsMenu {
  private readonly panel: HTMLElement | null;
  private readonly toggle: HTMLElement | null;
  private readonly dampeningSlider: HTMLInputElement | null;
  private readonly thrustSlider: HTMLInputElement | null;
  private readonly maxSpeedSlider: HTMLInputElement | null;
  private readonly dampeningValue: HTMLElement | null;
  private readonly thrustValue: HTMLElement | null;
  private readonly maxSpeedValue: HTMLElement | null;

  constructor() {
    this.panel = document.querySelector('#settings-panel');
    this.toggle = document.querySelector('#settings-toggle');
    this.dampeningSlider = document.querySelector<HTMLInputElement>('#dampening-slider');
    this.thrustSlider = document.querySelector<HTMLInputElement>('#thrust-slider');
    this.maxSpeedSlider = document.querySelector<HTMLInputElement>('#maxspeed-slider');
    this.dampeningValue = document.querySelector<HTMLElement>('#dampening-value');
    this.thrustValue = document.querySelector<HTMLElement>('#thrust-value');
    this.maxSpeedValue = document.querySelector<HTMLElement>('#maxspeed-value');

    this.toggle?.addEventListener('click', () => this.togglePanel());
    this.dampeningSlider?.addEventListener('input', () => this.syncLabel(this.dampeningValue, this.dampeningSlider, 1));
    this.thrustSlider?.addEventListener('input', () => this.syncLabel(this.thrustValue, this.thrustSlider, 0));
    this.maxSpeedSlider?.addEventListener('input', () => this.syncLabel(this.maxSpeedValue, this.maxSpeedSlider, 0));
  }

  getControlTuning(): ControlTuning {
    return {
      dampening: this.read(this.dampeningSlider, 1.5),
      thrustAccel: this.read(this.thrustSlider, 170),
      maxSpeed: this.read(this.maxSpeedSlider, 650),
    };
  }

  private togglePanel(): void { this.panel?.classList.toggle('hidden'); }

  private read(slider: HTMLInputElement | null, fallback: number): number {
    const value = Number(slider?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  private syncLabel(label: HTMLElement | null, slider: HTMLInputElement | null, digits: number): void {
    if (label && slider) label.textContent = Number(slider.value).toFixed(digits);
  }
}
