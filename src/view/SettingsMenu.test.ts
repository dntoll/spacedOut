import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsMenu } from './SettingsMenu';
import { StorageAdapter, type KeyValueStore } from './StorageAdapter';

interface MockElement {
  value?: string;
  textContent: string;
  classList: { toggle: ReturnType<typeof vi.fn>; add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  addEventListener: ReturnType<typeof vi.fn>;
  handlers: Map<string, () => void>;
}

function makeElement(value?: string): MockElement {
  const el: MockElement = {
    value,
    textContent: '',
    classList: { toggle: vi.fn(), add: vi.fn(), remove: vi.fn() },
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
    ['#settings-dev', makeElement()],
    ['#dampening-slider', makeElement('2')],
    ['#thrust-slider', makeElement('500')],
    ['#maxspeed-slider', makeElement('1000')],
    ['#dampening-value', makeElement()],
    ['#thrust-value', makeElement()],
    ['#maxspeed-value', makeElement()],
    ['#music-slider', makeElement('50')],
    ['#music-value', makeElement()],
    ['#particle-slider', makeElement('40')],
    ['#particle-value', makeElement()],
    ['#zoom-slider', makeElement('1.15')],
    ['#zoom-value', makeElement()],
    ['#sfx-master-slider', makeElement('60')],
    ['#sfx-master-value', makeElement()],
    ['#sfx-thrust-slider', makeElement('46')],
    ['#sfx-thrust-value', makeElement()],
    ['#sfx-laser-slider', makeElement('50')],
    ['#sfx-laser-value', makeElement()],
    ['#sfx-laser-hit-slider', makeElement('61')],
    ['#sfx-laser-hit-value', makeElement()],
    ['#sfx-asteroid-slider', makeElement('42')],
    ['#sfx-asteroid-value', makeElement()],
    ['#sfx-ship-slider', makeElement('100')],
    ['#sfx-ship-value', makeElement()],
    ['#sfx-collectable-slider', makeElement('100')],
    ['#sfx-collectable-value', makeElement()],
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

    expect(tuning.dampening).toBeCloseTo(2, 5);
    expect(tuning.thrustAccel).toBe(500);
    expect(tuning.maxSpeed).toBe(1000);
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
    expect(saved?.thrustAccel).toBe(500);
    expect(saved?.maxSpeed).toBe(1000);
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

    expect(menu.getParticleVisibility()).toBeCloseTo(0.4, 5);
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

  it('REQ-50 exposes the default zoom level from the slider', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    expect(menu.getDefaultZoomLevel()).toBeCloseTo(1.15, 5);
  });

  it('REQ-50 reflects zoom slider changes in the level', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    elements.get('#zoom-slider')!.value = '1.6';

    expect(menu.getDefaultZoomLevel()).toBeCloseTo(1.6, 5);
  });

  it('REQ-50 loads persisted zoom level into the slider on startup', () => {
    const store = new FakeStore();
    store.setItem('default-zoom', JSON.stringify(1.6));
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(store));

    expect(elements.get('#zoom-slider')!.value).toBe('1.60');
    expect(elements.get('#zoom-value')!.textContent).toBe('1.60');
    expect(menu.getDefaultZoomLevel()).toBeCloseTo(1.6, 5);
  });

  it('REQ-50 saves the zoom level when the slider changes', () => {
    const store = new FakeStore();
    const elements = buildDocument();
    stubDocument(elements);
    new SettingsMenu(new StorageAdapter(store));

    elements.get('#zoom-slider')!.value = '0.8';
    elements.get('#zoom-slider')!.handlers.get('input')!();

    const saved = new StorageAdapter(store).read<number>('default-zoom');
    expect(saved).toBeCloseTo(0.8, 5);
  });

  it('REQ-45 exposes the default SFX settings from the sliders', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    const sfx = menu.getSfxSettings();
    expect(sfx.master).toBeCloseTo(0.6, 5);
    expect(sfx.thrust).toBeCloseTo(0.46, 5);
    expect(sfx.laserShot).toBeCloseTo(0.5, 5);
    expect(sfx.laserHit).toBeCloseTo(0.61, 5);
    expect(sfx.asteroidCollision).toBeCloseTo(0.42, 5);
    expect(sfx.shipCollision).toBeCloseTo(1, 5);
    expect(sfx.collectable).toBeCloseTo(1, 5);
  });

  it('REQ-45 reflects SFX slider changes in the settings', () => {
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(new FakeStore()));

    elements.get('#sfx-master-slider')!.value = '40';
    elements.get('#sfx-laser-slider')!.value = '25';
    elements.get('#sfx-collectable-slider')!.value = '70';

    const sfx = menu.getSfxSettings();
    expect(sfx.master).toBeCloseTo(0.4, 5);
    expect(sfx.laserShot).toBeCloseTo(0.25, 5);
    expect(sfx.collectable).toBeCloseTo(0.7, 5);
  });

  it('REQ-45 loads persisted SFX settings into the sliders on startup', () => {
    const store = new FakeStore();
    store.setItem('sfx-settings', JSON.stringify({
      master: 40, thrust: 60, laserShot: 25, laserHit: 0, asteroidCollision: 80, shipCollision: 10, collectable: 55,
    }));
    const elements = buildDocument();
    stubDocument(elements);
    const menu = new SettingsMenu(new StorageAdapter(store));

    expect(elements.get('#sfx-master-slider')!.value).toBe('40');
    expect(elements.get('#sfx-master-value')!.textContent).toBe('40');
    expect(elements.get('#sfx-laser-hit-slider')!.value).toBe('0');
    expect(elements.get('#sfx-collectable-slider')!.value).toBe('55');
    expect(elements.get('#sfx-collectable-value')!.textContent).toBe('55');
    expect(menu.getSfxSettings().master).toBeCloseTo(0.4, 5);
    expect(menu.getSfxSettings().laserHit).toBeCloseTo(0, 5);
    expect(menu.getSfxSettings().collectable).toBeCloseTo(0.55, 5);
  });

  it('REQ-45 saves the SFX settings when a slider changes', () => {
    const store = new FakeStore();
    const elements = buildDocument();
    stubDocument(elements);
    new SettingsMenu(new StorageAdapter(store));

    elements.get('#sfx-thrust-slider')!.value = '30';
    elements.get('#sfx-thrust-slider')!.handlers.get('input')!();

    const saved = new StorageAdapter(store).read<Record<string, number>>('sfx-settings');
    expect(saved?.thrust).toBe(30);
  });

  it('REQ-78 reveals the dev settings section during development builds', () => {
    const elements = buildDocument();
    stubDocument(elements);
    new SettingsMenu(new StorageAdapter(new FakeStore()), true);

    expect(elements.get('#settings-dev')!.classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('REQ-78 keeps the dev settings section hidden in production builds', () => {
    const elements = buildDocument();
    stubDocument(elements);
    new SettingsMenu(new StorageAdapter(new FakeStore()), false);

    expect(elements.get('#settings-dev')!.classList.remove).not.toHaveBeenCalled();
  });
});
