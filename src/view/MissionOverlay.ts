import { MissionPhase } from '../model';

export class MissionOverlay {
  private readonly node = document.querySelector<HTMLElement>('#mission');
  private readonly titleNode = document.querySelector<HTMLElement>('#mission-title');
  private readonly signalNode = document.querySelector<HTMLElement>('#mission-signal');
  private readonly detailNode = document.querySelector<HTMLElement>('#mission-detail');
  private clickRequested = false;

  constructor() {
    this.node?.addEventListener('click', () => { this.clickRequested = true; });
  }

  show(phase: MissionPhase): void {
    if (!this.node) return;
    if (phase === MissionPhase.Mission1Intro) {
      this.setText('Mission: refill resources, watch out for mining drones.', '', 'Click to continue.');
      this.node.classList.remove('hidden');
    } else if (phase === MissionPhase.Mission1Done) {
      this.setText('well done', 'We have picked up a long distance signal.', 'Click to continue.');
      this.node.classList.remove('hidden');
    } else if (phase === MissionPhase.Mission2Intro) {
      this.setText('Mission 2: Traverse empty space towards signal.', 'Destroy pirates to recover both wing-gun upgrades.', 'Click to continue.');
      this.node.classList.remove('hidden');
    } else if (phase === MissionPhase.Mission2Done) {
      this.setText('Well done', '', 'Click to continue.');
      this.node.classList.remove('hidden');
    } else if (phase === MissionPhase.Mission3Intro) {
      this.setText('Mission 3: Enter the abandoned space station and reach its central chamber.', 'Find the switches to open the gates.', 'Click to continue.');
      this.node.classList.remove('hidden');
    } else if (phase === MissionPhase.Mission3Done) {
      this.setText('Well done', 'You reached the central chamber and found the clues.', 'Click to continue.');
      this.node.classList.remove('hidden');
    } else {
      this.hide();
    }
  }

  hide(): void { this.node?.classList.add('hidden'); }

  consumeClick(): boolean {
    if (this.clickRequested) {
      this.clickRequested = false;
      return true;
    }
    return false;
  }

  private setText(title: string, signal: string, detail: string): void {
    if (this.titleNode) this.titleNode.textContent = title;
    if (this.signalNode) this.signalNode.textContent = signal;
    if (this.detailNode) this.detailNode.textContent = detail;
  }
}
