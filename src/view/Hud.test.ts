import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hud } from './Hud';

describe('Hud', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('REQ-15 displays current air and fuel levels', () => {
    const nodes = new Map<string, { textContent: string; style: { width: string }; classList: { add: ReturnType<typeof vi.fn> } }>();
    for (const selector of ['#speed', '#hint', '#air-value', '#fuel-value', '#air-fill', '#fuel-fill']) {
      nodes.set(selector, { textContent: '', style: { width: '' }, classList: { add: vi.fn() } });
    }
    vi.stubGlobal('document', { querySelector: (selector: string) => nodes.get(selector) });
    const hud = new Hud();

    hud.updateResources(63.2, 41.7);

    expect(nodes.get('#air-value')?.textContent).toBe('64');
    expect(nodes.get('#fuel-value')?.textContent).toBe('42');
    expect(nodes.get('#air-fill')?.style.width).toBe('63.2%');
    expect(nodes.get('#fuel-fill')?.style.width).toBe('41.7%');
  });
});
