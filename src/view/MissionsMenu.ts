import { MissionPhase } from '../model';

export type MissionSelection = 1 | 2 | 3 | 4;

export class MissionsMenu {
  private readonly panel: HTMLElement | null;
  private readonly toggle: HTMLElement | null;
  private readonly mission1Button: HTMLElement | null;
  private readonly mission2Button: HTMLElement | null;
  private readonly mission3Button: HTMLElement | null;
  private readonly mission4Button: HTMLElement | null;
  private pendingSelection: MissionSelection | null = null;

  constructor() {
    this.panel = document.querySelector('#missions-panel');
    this.toggle = document.querySelector('#missions-toggle');
    this.mission1Button = document.querySelector('#mission-1');
    this.mission2Button = document.querySelector('#mission-2');
    this.mission3Button = document.querySelector('#mission-3');
    this.mission4Button = document.querySelector('#mission-4');
    this.toggle?.addEventListener('click', () => this.togglePanel());
    this.mission1Button?.addEventListener('click', () => this.select(1));
    this.mission2Button?.addEventListener('click', () => this.select(2));
    this.mission3Button?.addEventListener('click', () => this.select(3));
    this.mission4Button?.addEventListener('click', () => this.select(4));
  }

  setCurrentMissionFrom(phase: MissionPhase): void {
    const mission1 = phase === MissionPhase.Mission1Intro
      || phase === MissionPhase.Mission1Active
      || phase === MissionPhase.Mission1Done
      || phase === MissionPhase.Transition;
    const mission3 = phase === MissionPhase.Mission3Intro
      || phase === MissionPhase.Mission3Active
      || phase === MissionPhase.Mission3Done;
    const mission4 = phase === MissionPhase.Mission4Intro
      || phase === MissionPhase.Mission4Active
      || phase === MissionPhase.Mission4Done;
    this.mission1Button?.classList.toggle('active', mission1);
    this.mission2Button?.classList.toggle('active', !mission1 && !mission3 && !mission4);
    this.mission3Button?.classList.toggle('active', mission3);
    this.mission4Button?.classList.toggle('active', mission4);
  }

  consumeSelection(): MissionSelection | null {
    if (this.pendingSelection !== null) {
      const selection = this.pendingSelection;
      this.pendingSelection = null;
      this.hide();
      return selection;
    }
    return null;
  }

  private togglePanel(): void { this.panel?.classList.toggle('hidden'); }

  private hide(): void { this.panel?.classList.add('hidden'); }

  private select(mission: MissionSelection): void {
    this.pendingSelection = mission;
  }
}
