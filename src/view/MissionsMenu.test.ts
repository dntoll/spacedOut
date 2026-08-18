import { afterEach, describe, expect, it, vi } from 'vitest';
import { MissionPhase } from '../model';
import { MissionsMenu } from './MissionsMenu';

type StubNode = {
  classList: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; toggle: ReturnType<typeof vi.fn> };
  addEventListener: ReturnType<typeof vi.fn>;
};

const stubNodes = (): Map<string, StubNode> => {
  const nodes = new Map<string, StubNode>();
  for (const selector of ['#missions-panel', '#missions-toggle', '#mission-1', '#mission-2']) {
    nodes.set(selector, {
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
      addEventListener: vi.fn(),
    });
  }
  vi.stubGlobal('document', { querySelector: (selector: string) => nodes.get(selector) ?? null });
  return nodes;
};

describe('MissionsMenu', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('REQ-66 toggles the panel open and closed', () => {
    const nodes = stubNodes();
    const menu = new MissionsMenu();
    const toggleHandler = nodes.get('#missions-toggle')!.addEventListener.mock.calls[0][1] as () => void;

    toggleHandler();
    expect(nodes.get('#missions-panel')?.classList.toggle).toHaveBeenCalledWith('hidden');

    toggleHandler();
    expect(nodes.get('#missions-panel')?.classList.toggle).toHaveBeenCalledTimes(2);
  });

  it('REQ-66 latches a mission selection and consumes it once', () => {
    const nodes = stubNodes();
    const menu = new MissionsMenu();
    const pickMission2 = nodes.get('#mission-2')!.addEventListener.mock.calls[0][1] as () => void;

    expect(menu.consumeSelection()).toBeNull();

    pickMission2();

    expect(menu.consumeSelection()).toBe(2);
    expect(menu.consumeSelection()).toBeNull();
  });

  it('REQ-66 hides the panel after a selection is consumed', () => {
    const nodes = stubNodes();
    const menu = new MissionsMenu();
    const pickMission1 = nodes.get('#mission-1')!.addEventListener.mock.calls[0][1] as () => void;
    pickMission1();

    menu.consumeSelection();

    expect(nodes.get('#missions-panel')?.classList.add).toHaveBeenCalledWith('hidden');
  });

  it('REQ-66 highlights the active mission from the current phase', () => {
    const nodes = stubNodes();
    const menu = new MissionsMenu();

    menu.setCurrentMissionFrom(MissionPhase.Mission1Active);
    expect(nodes.get('#mission-1')?.classList.toggle).toHaveBeenCalledWith('active', true);
    expect(nodes.get('#mission-2')?.classList.toggle).toHaveBeenCalledWith('active', false);

    menu.setCurrentMissionFrom(MissionPhase.Mission2Intro);
    expect(nodes.get('#mission-1')?.classList.toggle).toHaveBeenCalledWith('active', false);
    expect(nodes.get('#mission-2')?.classList.toggle).toHaveBeenCalledWith('active', true);
  });
});
