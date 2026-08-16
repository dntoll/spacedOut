export class Hud {
  private readonly speedNode = document.querySelector<HTMLElement>('#speed');
  private readonly hintNode = document.querySelector<HTMLElement>('#hint');

  updateSpeed(speed: number): void {
    if (this.speedNode) this.speedNode.textContent = Math.round(speed).toString().padStart(3, '0');
  }

  dismissHint(): void { this.hintNode?.classList.add('hidden'); }
}
