export class Hud {
  private readonly speedNode = document.querySelector<HTMLElement>('#speed');
  private readonly speedBoxNode = document.querySelector<HTMLElement>('.speed');
  private readonly hintNode = document.querySelector<HTMLElement>('#hint');
  private readonly fuelValueNode = document.querySelector<HTMLElement>('#fuel-value');
  private readonly hpValueNode = document.querySelector<HTMLElement>('#hp-value');
  private readonly ammoValueNode = document.querySelector<HTMLElement>('#ammo-value');
  private readonly fuelFillNode = document.querySelector<HTMLElement>('#fuel-fill');
  private readonly hpFillNode = document.querySelector<HTMLElement>('#hp-fill');
  private readonly ammoFillNode = document.querySelector<HTMLElement>('#ammo-fill');
  private readonly shieldNode = document.querySelector<HTMLElement>('#shield');
  private readonly shieldValueNode = document.querySelector<HTMLElement>('#shield-value');
  private readonly shieldFillNode = document.querySelector<HTMLElement>('#shield-fill');

  updateSpeed(speed: number, damageThreshold: number): void {
    if (this.speedNode) this.speedNode.textContent = Math.round(speed).toString().padStart(3, '0');
    if (this.speedBoxNode) this.speedBoxNode.classList.toggle('warning', speed > damageThreshold);
  }

  updateResources(fuel: number, hp: number, ammo: number): void {
    const fuelPercent = Math.max(0, Math.min(100, fuel));
    const hpPercent = Math.max(0, Math.min(100, hp));
    const ammoPercent = Math.max(0, Math.min(100, ammo));
    if (this.fuelValueNode) this.fuelValueNode.textContent = Math.ceil(fuelPercent).toString();
    if (this.hpValueNode) this.hpValueNode.textContent = Math.ceil(hpPercent).toString();
    if (this.ammoValueNode) this.ammoValueNode.textContent = Math.ceil(ammoPercent).toString();
    if (this.fuelFillNode) this.fuelFillNode.style.width = `${fuelPercent}%`;
    if (this.hpFillNode) this.hpFillNode.style.width = `${hpPercent}%`;
    if (this.ammoFillNode) this.ammoFillNode.style.width = `${ammoPercent}%`;
  }

  updateShield(shield: number, installed: boolean): void {
    this.shieldNode?.classList.toggle('hidden', !installed);
    if (!installed) return;
    const percent = Math.max(0, Math.min(100, shield));
    if (this.shieldValueNode) this.shieldValueNode.textContent = Math.floor(percent).toString();
    if (this.shieldFillNode) this.shieldFillNode.style.width = `${percent}%`;
  }

  dismissHint(): void { this.hintNode?.classList.add('hidden'); }
}
