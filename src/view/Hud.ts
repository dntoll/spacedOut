export class Hud {
  private readonly speedNode = document.querySelector<HTMLElement>('#speed');
  private readonly hintNode = document.querySelector<HTMLElement>('#hint');
  private readonly airValueNode = document.querySelector<HTMLElement>('#air-value');
  private readonly fuelValueNode = document.querySelector<HTMLElement>('#fuel-value');
  private readonly hpValueNode = document.querySelector<HTMLElement>('#hp-value');
  private readonly airFillNode = document.querySelector<HTMLElement>('#air-fill');
  private readonly fuelFillNode = document.querySelector<HTMLElement>('#fuel-fill');
  private readonly hpFillNode = document.querySelector<HTMLElement>('#hp-fill');

  updateSpeed(speed: number): void {
    if (this.speedNode) this.speedNode.textContent = Math.round(speed).toString().padStart(3, '0');
  }

  updateResources(air: number, fuel: number, hp: number): void {
    const airPercent = Math.max(0, Math.min(100, air));
    const fuelPercent = Math.max(0, Math.min(100, fuel));
    const hpPercent = Math.max(0, Math.min(100, hp));
    if (this.airValueNode) this.airValueNode.textContent = Math.ceil(airPercent).toString();
    if (this.fuelValueNode) this.fuelValueNode.textContent = Math.ceil(fuelPercent).toString();
    if (this.hpValueNode) this.hpValueNode.textContent = Math.ceil(hpPercent).toString();
    if (this.airFillNode) this.airFillNode.style.width = `${airPercent}%`;
    if (this.fuelFillNode) this.fuelFillNode.style.width = `${fuelPercent}%`;
    if (this.hpFillNode) this.hpFillNode.style.width = `${hpPercent}%`;
  }

  dismissHint(): void { this.hintNode?.classList.add('hidden'); }
}
