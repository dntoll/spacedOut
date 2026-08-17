import { afterEach, describe, expect, it, vi } from 'vitest';
import { MissionPhase } from '../model';
import { MissionOverlay } from './MissionOverlay';

type StubNode = {
  textContent: string;
  classList: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; contains: ReturnType<typeof vi.fn> };
  addEventListener: ReturnType<typeof vi.fn>;
};

const stubNodes = (): Map<string, StubNode> => {
  const nodes = new Map<string, StubNode>();
  for (const selector of ['#mission', '#mission-title', '#mission-detail']) {
    nodes.set(selector, {
      textContent: '',
      classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() },
      addEventListener: vi.fn(),
    });
  }
  vi.stubGlobal('document', { querySelector: (selector: string) => nodes.get(selector) ?? null });
  return nodes;
};

describe('MissionOverlay', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('REQ-52 shows the mission 1 briefing during the intro', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission1Intro);

    expect(nodes.get('#mission-title')?.textContent).toBe('Mission: refill resources, watch out for mining drones.');
    expect(nodes.get('#mission-detail')?.textContent).toBe('Click to continue.');
    expect(nodes.get('#mission')?.classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('REQ-53 shows well done when mission 1 is complete', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission1Done);

    expect(nodes.get('#mission-title')?.textContent).toBe('well done');
    expect(nodes.get('#mission-detail')?.textContent).toBe('Click to continue.');
    expect(nodes.get('#mission')?.classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('REQ-55 shows the mission 2 briefing', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission2Intro);

    expect(nodes.get('#mission-title')?.textContent).toBe('Mission: traverse empty space');
    expect(nodes.get('#mission-detail')?.textContent).toBe('Click to continue.');
    expect(nodes.get('#mission')?.classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('hides the overlay during active and transition phases', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission1Active);

    expect(nodes.get('#mission')?.classList.add).toHaveBeenCalledWith('hidden');
  });

  it('REQ-52 consumes a continue click once', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();
    const missionNode = nodes.get('#mission')!;
    const handler = missionNode.addEventListener.mock.calls[0][1] as () => void;

    handler();
    expect(overlay.consumeClick()).toBe(true);
    expect(overlay.consumeClick()).toBe(false);
  });
});
