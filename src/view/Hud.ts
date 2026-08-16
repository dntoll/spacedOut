export class Hud {
  private readonly speedNode = document.querySelector<HTMLElement>('#speed');
  private readonly hintNode = document.querySelector<HTMLElement>('#hint');
  private readonly airValueNode = document.querySelector<HTMLElement>('#air-value');
  private readonly fuelValueNode = document.querySelector<HTMLElement>('#fuel-value');
  private readonly airFillNode = document.querySelector<HTMLElement>('#air-fill');
  private readonly fuelFillNode = document.querySelector<HTMLElement>('#fuel-fill');

  updateSpeed(speed: number): void {
    if (this.speedNode) this.speedNode.textContent = Math.round(speed).toString().padStart(3, '0');
  }

  updateResources(air: number, fuel: number): void {
    const airPercent = Math.max(0, Math.min(100, air));
    const fuelPercent = Math.max(0, Math.min(100, fuel));
    if (this.airValueNode) this.airValueNode.textContent = Math.ceil(airPercent).toString();
    if (this.fuelValueNode) this.fuelValueNode.textContent = Math.ceil(fuelPercent).toString();
    if (this.airFillNode) this.airFillNode.style.width = `${airPercent}%`;
    if (this.fuelFillNode) this.fuelFillNode.style.width = `${fuelPercent}%`;
  }

  dismissHint(): void { this.hintNode?.classList.add('hidden'); }
}
