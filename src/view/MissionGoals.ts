import { MissionGoalKind, type MissionGoal } from '../model';

const GOAL_LABELS: ReadonlyMap<MissionGoalKind, string> = new Map([
  [MissionGoalKind.RefillFuel, 'Refill fuel'],
  [MissionGoalKind.RefillHull, 'Refill hull'],
  [MissionGoalKind.RefillAmmo, 'Refill ammo'],
  [MissionGoalKind.AvoidDrones, 'Avoid getting killed by drones'],
  [MissionGoalKind.TraverseToSignal, 'Traverse to signal'],
  [MissionGoalKind.RecoverLeftWingGun, 'Recover left wing gun (destroy pirates)'],
  [MissionGoalKind.RecoverRightWingGun, 'Recover right wing gun (destroy pirates)'],
  [MissionGoalKind.OpenGate1, 'Open gate 1 (find its switch)'],
  [MissionGoalKind.OpenGate2, 'Open gate 2 (find its switch)'],
  [MissionGoalKind.OpenGate3, 'Open gate 3 (find its switch)'],
  [MissionGoalKind.ReachCentralChamber, 'Reach the central chamber'],
]);

export class MissionGoals {
  private readonly node = document.querySelector<HTMLElement>('#mission-goals');
  private readonly listNode = document.querySelector<HTMLElement>('#mission-goals-list');

  update(goals: readonly MissionGoal[]): void {
    if (!this.node || !this.listNode) return;
    if (goals.length === 0) {
      this.node.classList.add('hidden');
      return;
    }
    this.node.classList.remove('hidden');
    this.listNode.replaceChildren(...goals.map((goal) => this.createRow(goal)));
  }

  private createRow(goal: MissionGoal): HTMLElement {
    const row = document.createElement('li');
    if (goal.complete) row.classList.add('checked');
    const box = document.createElement('span');
    box.className = 'mission-goal-box';
    box.textContent = goal.complete ? '\u2713' : '';
    const label = document.createElement('span');
    label.className = 'mission-goal-label';
    label.textContent = GOAL_LABELS.get(goal.kind) ?? '';
    row.append(box, label);
    return row;
  }
}
