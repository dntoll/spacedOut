import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsMenu } from './SettingsMenu';
import { StorageAdapter, type KeyValueStore } from './StorageAdapter';

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

class FakeStore implements KeyValueStore {
  private map = new Map<string, string>();
  getItem(key: string): string | null { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string): void { this.map.set(key, value); }
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
    ['#music-slider', makeElement('50')],
    ['#music-value', makeElement()],
    ['#medium-slider', makeElement('25')],
    ['#medium-value', makeElement()],
    ['#action-slider', makeElement('60')],
    ['#action-value', makeElement()],
    ['#particle-slider', makeElement('100')],
    ['#particle-value', makeElement()],
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
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    const tuning = menu.getControlTuning();

    expect(tuning.dampening).toBeCloseTo(1.5, 5);
    expect(tuning.thrustAccel).toBe(170);
    expect(tuning.maxSpeed).toBe(650);
  });

  it('REQ-27 reflects slider changes in the tuning', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

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
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    elements.get('#settings-toggle')!.handlers.get('click')!();

    expect(elements.get('#settings-panel')!.classList.toggle).toHaveBeenCalledOnce();
  });

  it('REQ-28 loads persisted tuning into the sliders on startup', () => {
    const store = new FakeStore();
    store.setItem('control-tuning', JSON.stringify({ dampening: 3.2, thrustAccel: 260, maxSpeed: 900 }));
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(store));

    expect(elements.get('#dampening-slider')!.value).toBe('3.2');
    expect(elements.get('#thrust-slider')!.value).toBe('260');
    expect(elements.get('#maxspeed-slider')!.value).toBe('900');
    expect(elements.get('#dampening-value')!.textContent).toBe('3.2');
    expect(menu.getControlTuning().maxSpeed).toBe(900);
  });

  it('REQ-28 saves the current tuning when a slider changes', () => {
    const store = new FakeStore();
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(store));

    elements.get('#dampening-slider')!.value = '4.0';
    elements.get('#dampening-slider')!.handlers.get('input')!();

    const saved = new StorageAdapter(store).read<{ dampening: number; thrustAccel: number; maxSpeed: number }>('control-tuning');
    expect(saved?.dampening).toBe(4);
    expect(saved?.thrustAccel).toBe(170);
    expect(saved?.maxSpeed).toBe(650);
  });

  it('REQ-30 exposes the default music level from the slider', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    expect(menu.getMusicLevel()).toBeCloseTo(0.5, 5);
  });

  it('REQ-30 reflects music slider changes in the level', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    elements.get('#music-slider')!.value = '80';

    expect(menu.getMusicLevel()).toBeCloseTo(0.8, 5);
  });

  it('REQ-30 loads persisted music level into the slider on startup', () => {
    const store = new FakeStore();
    store.setItem('music-level', JSON.stringify(80));
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(store));

    expect(elements.get('#music-slider')!.value).toBe('80');
    expect(elements.get('#music-value')!.textContent).toBe('80');
    expect(menu.getMusicLevel()).toBeCloseTo(0.8, 5);
  });

  it('REQ-30 saves the music level when the slider changes', () => {
    const store = new FakeStore();
    const elements = buildDocument();
    stubDocument(elements);
    new SettingsMenu(new StorageAdapter(store));

    elements.get('#music-slider')!.value = '25';
    elements.get('#music-slider')!.handlers.get('input')!();

    const saved = new StorageAdapter(store).read<number>('music-level');
    expect(saved).toBe(25);
  });

  it('REQ-32 exposes the default particle visibility from the slider', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    expect(menu.getParticleVisibility()).toBeCloseTo(1, 5);
  });

  it('REQ-32 reflects particle slider changes in the visibility', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    elements.get('#particle-slider')!.value = '40';

    expect(menu.getParticleVisibility()).toBeCloseTo(0.4, 5);
  });

  it('REQ-32 loads persisted particle visibility into the slider on startup', () => {
    const store = new FakeStore();
    store.setItem('particle-visibility', JSON.stringify(60));
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(store));

    expect(elements.get('#particle-slider')!.value).toBe('60');
    expect(elements.get('#particle-value')!.textContent).toBe('60');
    expect(menu.getParticleVisibility()).toBeCloseTo(0.6, 5);
  });

  it('REQ-32 saves the particle visibility when the slider changes', () => {
    const store = new FakeStore();
    const elements = buildDocument();
    stubDocument(elements);
    new SettingsMenu(new StorageAdapter(store));

    elements.get('#particle-slider')!.value = '20';
    elements.get('#particle-slider')!.handlers.get('input')!();

    const saved = new StorageAdapter(store).read<number>('particle-visibility');
    expect(saved).toBe(20);
  });

  it('REQ-29 exposes the default music thresholds from the sliders', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    const thresholds = menu.getMusicThresholds();
    expect(thresholds.medium).toBeCloseTo(0.25, 5);
    expect(thresholds.action).toBeCloseTo(0.6, 5);
  });

  it('REQ-29 reflects threshold slider changes', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    elements.get('#medium-slider')!.value = '15';
    elements.get('#action-slider')!.value = '45';

    const thresholds = menu.getMusicThresholds();
    expect(thresholds.medium).toBeCloseTo(0.15, 5);
    expect(thresholds.action).toBeCloseTo(0.45, 5);
  });

  it('REQ-29 keeps the action threshold at least one hysteresis band above medium', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    elements.get('#medium-slider')!.value = '60';
    elements.get('#action-slider')!.value = '10';

    const thresholds = menu.getMusicThresholds();
    expect(thresholds.medium).toBeCloseTo(0.6, 5);
    expect(thresholds.action).toBeCloseTo(0.65, 5);
  });

  it('REQ-30 loads persisted thresholds into the sliders on startup', () => {
    const store = new FakeStore();
    store.setItem('music-thresholds', JSON.stringify({ medium: 15, action: 45 }));
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(store));

    expect(elements.get('#medium-slider')!.value).toBe('15');
    expect(elements.get('#medium-value')!.textContent).toBe('15');
    expect(elements.get('#action-slider')!.value).toBe('45');
    expect(elements.get('#action-value')!.textContent).toBe('45');
    expect(menu.getMusicThresholds().medium).toBeCloseTo(0.15, 5);
  });

  it('REQ-30 saves the thresholds when a slider changes', () => {
    const store = new FakeStore();
    const elements = buildDocument();
    stubDocument(elements);
    new SettingsMenu(new StorageAdapter(store));

    elements.get('#action-slider')!.value = '40';
    elements.get('#action-slider')!.handlers.get('input')!();

    const saved = new StorageAdapter(store).read<{ medium: number; action: number }>('music-thresholds');
    expect(saved?.medium).toBe(25);
    expect(saved?.action).toBe(40);
  });
});
