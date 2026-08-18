import { afterEach, describe, expect, it, vi } from 'vitest';
import { MissionGoalKind, type MissionGoal } from '../model';
import { MissionGoals } from './MissionGoals';

type StubNode = {
  classList: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  replaceChildren: ReturnType<typeof vi.fn>;
  appendChild: ReturnType<typeof vi.fn>;
  classList_toggle: ReturnType<typeof vi.fn>;
  className: string;
  textContent: string;
};

const stubNodes = (): Map<string, StubNode> => {
  const nodes = new Map<string, StubNode>();
  for (const selector of ['#mission-goals', '#mission-goals-list']) {
    nodes.set(selector, {
      classList: { add: vi.fn(), remove: vi.fn() },
      replaceChildren: vi.fn(),
      appendChild: vi.fn(),
      classList_toggle: vi.fn(),
      className: '',
      textContent: '',
    });
  }
  vi.stubGlobal('document', {
    querySelector: (selector: string) => nodes.get(selector) ?? null,
    createElement: (tag: string) => ({
      tagName: tag,
      classList: { add: vi.fn(), toggle: vi.fn() },
      className: '',
      textContent: '',
      append: vi.fn(),
      appendChild: vi.fn(),
    }),
  });
  return nodes;
};

describe('MissionGoals', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('REQ-74 hides the checklist when there are no goals', () => {
    const nodes = stubNodes();
    const goals = new MissionGoals();

    goals.update([]);

    expect(nodes.get('#mission-goals')?.classList.add).toHaveBeenCalledWith('hidden');
  });

  it('REQ-74 shows the mission 1 goals with checkbox rows', () => {
    const nodes = stubNodes();
    const goals = new MissionGoals();
    const items: MissionGoal[] = [
      { kind: MissionGoalKind.RefillFuel, complete: false },
      { kind: MissionGoalKind.AvoidDrones, complete: false },
    ];

    goals.update(items);

    expect(nodes.get('#mission-goals')?.classList.remove).toHaveBeenCalledWith('hidden');
    expect(nodes.get('#mission-goals-list')?.replaceChildren).toHaveBeenCalledTimes(1);
  });

  it('REQ-74 marks a goal row checked when complete', () => {
    const created: { classList_add: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal('document', {
      querySelector: (selector: string) => selector === '#mission-goals' || selector === '#mission-goals-list'
        ? { classList: { add: vi.fn(), remove: vi.fn() }, replaceChildren: vi.fn() }
        : null,
      createElement: (tag: string) => {
        const add = vi.fn();
        const node = { tagName: tag, classList: { add, toggle: vi.fn() }, className: '', textContent: '', append: vi.fn() };
        created.push({ classList_add: add });
        return node;
      },
    });
    const goals = new MissionGoals();

    goals.update([{ kind: MissionGoalKind.RefillFuel, complete: true }]);

    expect(created[0].classList_add).toHaveBeenCalledWith('checked');
  });

  it('REQ-74 leaves a goal row unchecked when incomplete', () => {
    const created: { classList_add: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal('document', {
      querySelector: () => ({ classList: { add: vi.fn(), remove: vi.fn() }, replaceChildren: vi.fn() }),
      createElement: (tag: string) => {
        const add = vi.fn();
        const node = { tagName: tag, classList: { add, toggle: vi.fn() }, className: '', textContent: '', append: vi.fn() };
        created.push({ classList_add: add });
        return node;
      },
    });
    const goals = new MissionGoals();

    goals.update([{ kind: MissionGoalKind.TraverseToSignal, complete: false }]);

    expect(created[0].classList_add).not.toHaveBeenCalledWith('checked');
  });
});
