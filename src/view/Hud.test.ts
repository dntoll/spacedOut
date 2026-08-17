import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hud } from './Hud';

type StubNode = { textContent: string; style: { width: string }; classList: { add: ReturnType<typeof vi.fn> } };

const stubHudNodes = (): Map<string, StubNode> => {
  const nodes = new Map<string, StubNode>();
  for (const selector of ['#speed', '#hint', '#air-value', '#fuel-value', '#hp-value', '#ammo-value', '#air-fill', '#fuel-fill', '#hp-fill', '#ammo-fill']) {
    nodes.set(selector, { textContent: '', style: { width: '' }, classList: { add: vi.fn() } });
  }
  vi.stubGlobal('document', { querySelector: (selector: string) => nodes.get(selector) });
  return nodes;
};

describe('Hud', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('REQ-15 displays current air and fuel levels', () => {
    const nodes = stubHudNodes();
    const hud = new Hud();

    hud.updateResources(63.2, 41.7, 100, 100);

    expect(nodes.get('#air-value')?.textContent).toBe('64');
    expect(nodes.get('#fuel-value')?.textContent).toBe('42');
    expect(nodes.get('#air-fill')?.style.width).toBe('63.2%');
    expect(nodes.get('#fuel-fill')?.style.width).toBe('41.7%');
  });

  it('REQ-33 displays the hull hit-points meter alongside air and fuel', () => {
    const nodes = stubHudNodes();
    const hud = new Hud();

    hud.updateResources(100, 100, 72.4, 100);

    expect(nodes.get('#hp-value')?.textContent).toBe('73');
    expect(nodes.get('#hp-fill')?.style.width).toBe('72.4%');
  });

  it('REQ-40 displays the ammo meter alongside air, fuel, and hull', () => {
    const nodes = stubHudNodes();
    const hud = new Hud();

    hud.updateResources(100, 100, 100, 48.6);

    expect(nodes.get('#ammo-value')?.textContent).toBe('49');
    expect(nodes.get('#ammo-fill')?.style.width).toBe('48.6%');
  });
});
