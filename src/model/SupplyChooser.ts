export enum SupplyType {
  Fuel,
  Hp,
  Ammo,
  Weapon,
  Shield,
}

export interface SupplyMeters {
  fuel: number;
  hp: number;
  ammo: number;
}

interface MeterEntry {
  type: SupplyType;
  level: number;
}

export class SupplyChooser {
  static choose(meters: SupplyMeters, visible: ReadonlySet<SupplyType>, random: () => number): SupplyType {
    const entries: MeterEntry[] = [
      { type: SupplyType.Fuel, level: meters.fuel },
      { type: SupplyType.Hp, level: meters.hp },
      { type: SupplyType.Ammo, level: meters.ammo },
    ];
    const tiers = this.tiers(entries);
    for (const tier of tiers) {
      this.shuffle(tier, random);
      for (const entry of tier) if (!visible.has(entry.type)) return entry.type;
    }
    return entries[Math.floor(random() * entries.length)].type;
  }

  private static tiers(entries: MeterEntry[]): MeterEntry[][] {
    const byLevel = new Map<number, MeterEntry[]>();
    for (const entry of entries) {
      const group = byLevel.get(entry.level) ?? [];
      group.push(entry);
      byLevel.set(entry.level, group);
    }
    return [...byLevel.keys()].sort((a, b) => a - b).map((level) => byLevel.get(level)!);
  }

  private static shuffle(items: MeterEntry[], random: () => number): void {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }
}
