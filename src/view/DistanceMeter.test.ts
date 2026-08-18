import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as Model from '../model';
import { DistanceMeter } from './DistanceMeter';

type StubNode = {
  textContent: string;
  style: { width: string };
  classList: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
};

const stubNodes = (): Map<string, StubNode> => {
  const nodes = new Map<string, StubNode>();
  for (const selector of ['#distance', '#distance-value', '#distance-fill']) {
    nodes.set(selector, { textContent: '', style: { width: '' }, classList: { add: vi.fn(), remove: vi.fn() } });
  }
  vi.stubGlobal('document', { querySelector: (selector: string) => nodes.get(selector) ?? null });
  return nodes;
};

describe('DistanceMeter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('REQ-61 hides the meter outside the traversal and shows remaining distance during it', () => {
    const nodes = stubNodes();
    const meter = new DistanceMeter();

    meter.update({ isTraversal: false, distanceRemaining: 80000, initialTravelDistance: 80000 } as unknown as Model.Mission);
    expect(nodes.get('#distance')?.classList.add).toHaveBeenCalledWith('hidden');

    meter.update({ isTraversal: true, distanceRemaining: 40000, initialTravelDistance: 80000 } as unknown as Model.Mission);
    expect(nodes.get('#distance')?.classList.remove).toHaveBeenCalledWith('hidden');
    expect(nodes.get('#distance-value')?.textContent).toBe('40000');
    expect(nodes.get('#distance-fill')?.style.width).toBe('50.0%');
  });

  it('REQ-61 depletes the meter as the remaining distance shrinks', () => {
    const nodes = stubNodes();
    const meter = new DistanceMeter();
    const mission = { isTraversal: true, distanceRemaining: 80000, initialTravelDistance: 80000 } as unknown as Model.Mission;

    meter.update(mission);
    expect(nodes.get('#distance-fill')?.style.width).toBe('100.0%');

    (mission as { distanceRemaining: number }).distanceRemaining = 0;
    meter.update(mission);
    expect(nodes.get('#distance-fill')?.style.width).toBe('0.0%');
    expect(nodes.get('#distance-value')?.textContent).toBe('0');
  });
});
