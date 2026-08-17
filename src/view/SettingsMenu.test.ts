import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsMenu } from './SettingsMenu';

interface MockElement {
  value?: string;
  textContent: string;
  classList: { toggle: ReturnType<typeof vi.fn>; add: ReturnType<typeof vi.fn> };
  addEventListener: ReturnType<typeof vi.fn>;
  handlers: Map<string, () => void>;
}

function makeElement(value?: string): MockElement {
  const el: MockElement = {
    value,
    textContent: '',
    classList: { toggle: vi.fn(), add: vi.fn() },
    addEventListener: vi.fn(),
    handlers: new Map(),
  };
  el.addEventListener.mockImplementation((type: string, cb: () => void) => { el.handlers.set(type, cb); });
  return el;
}

function buildDocument(): Map<string, MockElement> {
  return new Map<string, MockElement>([
    ['#settings-toggle', makeElement()],
    ['#settings-panel', makeElement()],
    ['#dampening-slider', makeElement('1.5')],
    ['#thrust-slider', makeElement('170')],
    ['#maxspeed-slider', makeElement('650')],
    ['#dampening-value', makeElement()],
    ['#thrust-value', makeElement()],
    ['#maxspeed-value', makeElement()],
  ]);
}

describe('SettingsMenu', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubDocument(elements: Map<string, MockElement>): void {
    vi.stubGlobal('document', { querySelector: (selector: string) => elements.get(selector) ?? null });
  }

  it('REQ-27 exposes default control tuning from the sliders', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu();

    const tuning = menu.getControlTuning();

    expect(tuning.dampening).toBeCloseTo(1.5, 5);
    expect(tuning.thrustAccel).toBe(170);
    expect(tuning.maxSpeed).toBe(650);
  });

  it('REQ-27 reflects slider changes in the tuning', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu();

    elements.get('#dampening-slider')!.value = '3.2';
    elements.get('#thrust-slider')!.value = '260';
    elements.get('#maxspeed-slider')!.value = '900';

    const tuning = menu.getControlTuning();

    expect(tuning.dampening).toBeCloseTo(3.2, 5);
    expect(tuning.thrustAccel).toBe(260);
    expect(tuning.maxSpeed).toBe(900);
  });

  it('REQ-27 toggles the panel visibility when the button is clicked', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu();

    elements.get('#settings-toggle')!.handlers.get('click')!();

    expect(elements.get('#settings-panel')!.classList.toggle).toHaveBeenCalledOnce();
  });
});
