export class BodyMass {
  static fromRadius(radius: number, surfaceDensity: number): number {
    return Math.PI * radius * radius * surfaceDensity;
  }
}
