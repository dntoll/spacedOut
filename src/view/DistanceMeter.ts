import type * as Model from '../model';

export class DistanceMeter {
  private readonly node = document.querySelector<HTMLElement>('#distance');
  private readonly valueNode = document.querySelector<HTMLElement>('#distance-value');
  private readonly fillNode = document.querySelector<HTMLElement>('#distance-fill');

  update(mission: Model.Mission): void {
    if (!this.node) return;
    if (!mission.isTraversal) {
      this.node.classList.add('hidden');
      return;
    }
    this.node.classList.remove('hidden');
    const remaining = mission.distanceRemaining;
    const initial = mission.initialTravelDistance;
    const fraction = initial > 0 ? Math.max(0, Math.min(1, remaining / initial)) : 0;
    if (this.valueNode) this.valueNode.textContent = Math.max(0, Math.round(remaining)).toString();
    if (this.fillNode) this.fillNode.style.width = `${(fraction * 100).toFixed(1)}%`;
  }
}
