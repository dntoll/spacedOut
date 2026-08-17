export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class StorageAdapter {
  constructor(private readonly backend: KeyValueStore | null) {}

  read<T>(key: string): T | null {
    const raw = this.backend?.getItem(key);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  write<T>(key: string, value: T): void {
    try {
      this.backend?.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable or full — preferences stay ephemeral */
    }
  }
}
