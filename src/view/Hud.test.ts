import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hud } from './Hud';

type StubNode = {
  textContent: string;
  style: { width: string };
  classList: { add: ReturnType<typeof vi.fn>; toggle: ReturnType<typeof vi.fn> };
};

const stubHudNodes = (): Map<string, StubNode> => {
  const nodes = new Map<string, StubNode>();
  const make = (): StubNode => ({
    textContent: '',
    style: { width: '' },
    classList: { add: vi.fn(), toggle: vi.fn() },
  });
  for (const selector of ['#speed', '#hint', '#fuel-value', '#hp-value', '#ammo-value', '#fuel-fill', '#hp-fill', '#ammo-fill', '.speed', '#shield', '#shield-value', '#shield-fill']) {
    nodes.set(selector, make());
  }
  vi.stubGlobal('document', { querySelector: (selector: string) => nodes.get(selector) });
  return nodes;
};

describe('Hud', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('REQ-15 displays the current fuel level', () => {
    const nodes = stubHudNodes();
    const hud = new Hud();

    hud.updateResources(41.7, 100, 100);

    expect(nodes.get('#fuel-value')?.textContent).toBe('42');
    expect(nodes.get('#fuel-fill')?.style.width).toBe('41.7%');
  });

  it('REQ-33 displays the hull hit-points meter alongside fuel', () => {
    const nodes = stubHudNodes();
    const hud = new Hud();

    hud.updateResources(100, 72.4, 100);

    expect(nodes.get('#hp-value')?.textContent).toBe('73');
    expect(nodes.get('#hp-fill')?.style.width).toBe('72.4%');
  });

  it('REQ-40 displays the ammo meter alongside fuel and hull', () => {
    const nodes = stubHudNodes();
    const hud = new Hud();

    hud.updateResources(100, 100, 48.6);

    expect(nodes.get('#ammo-value')?.textContent).toBe('49');
    expect(nodes.get('#ammo-fill')?.style.width).toBe('48.6%');
  });

  it('REQ-90 shows the shield meter only once the upgrade is installed', () => {
    const nodes = stubHudNodes();
    const hud = new Hud();

    hud.updateShield(0, false);
    expect(nodes.get('#shield')?.classList.toggle).toHaveBeenCalledWith('hidden', true);
    expect(nodes.get('#shield-value')?.textContent).toBe('');

    hud.updateShield(63.4, true);
    expect(nodes.get('#shield')?.classList.toggle).toHaveBeenCalledWith('hidden', false);
    expect(nodes.get('#shield-value')?.textContent).toBe('63');
    expect(nodes.get('#shield-fill')?.style.width).toBe('63.4%');
  });

  it('REQ-70 shows the speed in red with a warning when above the damage threshold', () => {
    const nodes = stubHudNodes();
    const hud = new Hud();

    hud.updateSpeed(640, 500);

    expect(nodes.get('#speed')?.textContent).toBe('640');
    const box = nodes.get('.speed');
    expect(box?.classList.toggle).toHaveBeenCalledWith('warning', true);
  });

  it('REQ-70 clears the speed warning when at or below the damage threshold', () => {
    const nodes = stubHudNodes();
    const hud = new Hud();

    hud.updateSpeed(500, 500);

    expect(nodes.get('.speed')?.classList.toggle).toHaveBeenCalledWith('warning', false);
  });
});
