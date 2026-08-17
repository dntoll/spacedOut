export class DamageCalculator {
  static readonly violentThreshold = 500;
  static readonly maxDamagePerHit = 49;
  private static readonly massiveFactor = 0.34;
  private static readonly regularFactor = 0.16;
  private static readonly regularCap = 24;

  static damageFor(impactSpeed: number, massive: boolean): number {
    if (impactSpeed <= this.violentThreshold) return 0;
    const excess = impactSpeed - this.violentThreshold;
    if (massive) return Math.min(this.maxDamagePerHit, excess * this.massiveFactor);
    return Math.min(this.regularCap, excess * this.regularFactor);
  }
}
