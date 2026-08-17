import { describe, expect, it } from 'vitest';
import { StorageAdapter, type KeyValueStore } from './StorageAdapter';

class FakeStore implements KeyValueStore {
  private map = new Map<string, string>();
  getItem(key: string): string | null { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string): void { this.map.set(key, value); }
  throws = false;
}

describe('StorageAdapter', () => {
  it('returns null when the backend has no entry', () => {
    const adapter = new StorageAdapter(new FakeStore());
    expect(adapter.read('missing')).toBeNull();
  });

  it('returns null when there is no backend', () => {
    const adapter = new StorageAdapter(null);
    expect(adapter.read('anything')).toBeNull();
  });

  it('round-trips a written value', () => {
    const store = new FakeStore();
    const adapter = new StorageAdapter(store);
    adapter.write('control-tuning', { dampening: 3.2, thrustAccel: 260, maxSpeed: 900 });
    expect(adapter.read<{ dampening: number }>('control-tuning')?.dampening).toBeCloseTo(3.2, 5);
  });

  it('returns null for malformed JSON', () => {
    const store = new FakeStore();
    store.setItem('broken', '{not json');
    const adapter = new StorageAdapter(store);
    expect(adapter.read('broken')).toBeNull();
  });

  it('does not throw when the backend rejects writes', () => {
    const store = new FakeStore();
    store.setItem = () => { throw new Error('quota'); };
    const adapter = new StorageAdapter(store);
    expect(() => adapter.write('k', { a: 1 })).not.toThrow();
  });
});
