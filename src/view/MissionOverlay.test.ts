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
  for (const selector of ['#mission', '#mission-title', '#mission-signal', '#mission-detail']) {
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

  it('REQ-53 shows well done with the long distance signal when mission 1 is complete', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission1Done);

    expect(nodes.get('#mission-title')?.textContent).toBe('well done');
    expect(nodes.get('#mission-signal')?.textContent).toBe('We have picked up a long distance signal.');
    expect(nodes.get('#mission-detail')?.textContent).toBe('Click to continue.');
    expect(nodes.get('#mission')?.classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('REQ-55 shows the mission 2 briefing with the wing-gun objective', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission2Intro);

    expect(nodes.get('#mission-title')?.textContent).toBe('Mission 2: Traverse empty space towards signal.');
    expect(nodes.get('#mission-signal')?.textContent).toBe('Destroy pirates to recover both wing-gun upgrades.');
    expect(nodes.get('#mission-detail')?.textContent).toBe('Click to continue.');
    expect(nodes.get('#mission')?.classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('clears the signal text on non-done phases', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission1Intro);

    expect(nodes.get('#mission-signal')?.textContent).toBe('');
  });

  it('hides the overlay during active and transition phases', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission1Active);

    expect(nodes.get('#mission')?.classList.add).toHaveBeenCalledWith('hidden');
  });

  it('REQ-64 shows well done with click to continue when mission 2 is complete', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission2Done);

    expect(nodes.get('#mission-title')?.textContent).toBe('Well done');
    expect(nodes.get('#mission-detail')?.textContent).toBe('Click to continue.');
    expect(nodes.get('#mission')?.classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('hides the overlay during the mission 2 traversal', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission2Active);

    expect(nodes.get('#mission')?.classList.add).toHaveBeenCalledWith('hidden');
  });

  it('REQ-76 shows the mission 3 briefing with the central-chamber objective', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission3Intro);

    expect(nodes.get('#mission-title')?.textContent).toBe('Mission 3: Enter the abandoned space station and reach its central chamber.');
    expect(nodes.get('#mission-signal')?.textContent).toBe('Find the switches to open the gates.');
    expect(nodes.get('#mission-detail')?.textContent).toBe('Click to continue.');
    expect(nodes.get('#mission')?.classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('REQ-76 hides the overlay during the active mission 3 maze', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission3Active);

    expect(nodes.get('#mission')?.classList.add).toHaveBeenCalledWith('hidden');
  });

  it('REQ-76 shows well done when mission 3 is complete', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission3Done);

    expect(nodes.get('#mission-title')?.textContent).toBe('Well done');
    expect(nodes.get('#mission-detail')?.textContent).toBe('Click to continue.');
    expect(nodes.get('#mission')?.classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('REQ-92 shows the mission 4 briefing toward Omega III', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission4Intro);

    expect(nodes.get('#mission-title')?.textContent).toBe('Mission 4: Space station computer records show last human entry five years ago travelled to star Omega III.');
    expect(nodes.get('#mission-signal')?.textContent).toBe('Lets go to see what happened to them...');
    expect(nodes.get('#mission-detail')?.textContent).toBe('Click to continue.');
    expect(nodes.get('#mission')?.classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('hides the overlay during the mission 4 traversal', () => {
    const nodes = stubNodes();
    const overlay = new MissionOverlay();

    overlay.show(MissionPhase.Mission4Active);

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
