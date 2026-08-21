import { clamp, length, normalize, sub } from '../math';
import type { Vec2 } from '../types';
import type { LinearPaint } from './Drawing';

const DEFAULT_LIGHT_DIRECTION: Vec2 = (() => {
  const v = { x: 0.6, y: 0.8 };
  const l = length(v);
  return { x: v.x / l, y: v.y / l };
})();

const MIN_DARK_LUMINANCE = 18;
const SHADOW_LENGTH_PER_RADIUS = 10;
const RIM_BRIGHTEN_TOWARD_WHITE = 0.92;
const PARTICLE_SHADOW_DARKEN = 0.85;

export interface ShadowCaster {
  position: Vec2;
  radius: number;
  outline?: Vec2[];
}

export interface ShadowCasters {
  readonly casters?: readonly ShadowCaster[];
  forEachCaster(visitor: (caster: ShadowCaster) => void): void;
}

export interface OutlinedShadowCasters extends ShadowCasters {
  forEachOutlinedCaster(visitor: (caster: ShadowCaster) => void): void;
}

export class StarLight {
  private readonly lightDir: Vec2;
  private readonly shadowLength: number;
  private pointSource: Vec2 | null = null;

  constructor(lightDirection: Vec2 = DEFAULT_LIGHT_DIRECTION, shadowLength = 2400) {
    const l = length(lightDirection);
    this.lightDir = l > 0.0001 ? { x: lightDirection.x / l, y: lightDirection.y / l } : DEFAULT_LIGHT_DIRECTION;
    this.shadowLength = shadowLength;
  }

  get direction(): Vec2 { return { ...this.lightDir }; }
  getShadowLength(): number { return this.shadowLength; }
  shadowLengthFor(radius: number): number { return Math.min(this.shadowLength, radius * SHADOW_LENGTH_PER_RADIUS); }

  setPointSource(position: Vec2 | null): void {
    this.pointSource = position ? { ...position } : null;
  }

  directionAt(position: Vec2): Vec2 {
    if (!this.pointSource) return { ...this.lightDir };
    const away = sub(position, this.pointSource);
    const dir = normalize(away);
    return length(dir) > 0 ? dir : { ...this.lightDir };
  }

  localDirection(angle: number, worldPosition?: Vec2): Vec2 {
    const world = worldPosition ? this.directionAt(worldPosition) : this.lightDir;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: world.x * cos + world.y * sin,
      y: -world.x * sin + world.y * cos,
    };
  }

  shadowFactor(position: Vec2, radius: number, casters: ShadowCasters | null): number {
    if (!casters) return 0;
    let maxFactor = 0;
    const visit = (occluder: ShadowCaster): void => {
      const light = this.directionAt(occluder.position);
      const dx = light.x;
      const dy = light.y;
      const rx = position.x - occluder.position.x;
      const ry = position.y - occluder.position.y;
      const along = rx * dx + ry * dy;
      if (along <= 0) return;
      const effectiveLength = this.shadowLengthFor(occluder.radius);
      if (along >= effectiveLength) return;
      const alongFade = 1 - along / effectiveLength;
      const occluderR = occluder.radius;
      const inner = occluderR - radius;
      const outer = occluderR + radius;
      const perpSq = rx * rx + ry * ry - along * along;
      let edgeFade: number;
      if (inner <= 0) {
        edgeFade = perpSq <= outer * outer ? 1 : 0;
      } else if (perpSq <= inner * inner) {
        edgeFade = 1;
      } else if (perpSq >= outer * outer) {
        edgeFade = 0;
      } else {
        const perp = Math.sqrt(perpSq);
        edgeFade = (outer - perp) / (outer - inner);
      }
      const factor = alongFade * edgeFade;
      if (factor > maxFactor) maxFactor = factor;
    };
    if (casters.casters) {
      for (const caster of casters.casters) visit(caster);
    } else {
      casters.forEachCaster(visit);
    }
    return clamp(maxFactor, 0, 1);
  }

  particleAlpha(position: Vec2, baseAlpha: number, casters: ShadowCasters | null): number {
    if (!casters) return baseAlpha;
    const shadow = this.shadowFactor(position, 0, casters);
    return baseAlpha * (1 - shadow * PARTICLE_SHADOW_DARKEN);
  }

  bodyPaint(localLightDir: Vec2, radius: number, litColor: string, darkColor: string, shadowFactor: number): LinearPaint {
    const s = clamp(shadowFactor, 0, 1);
    const flooredDark = this.raiseToFloor(darkColor);
    const lit = this.mixHex(litColor, flooredDark, s);
    const rim = this.mixHex(this.mixHex(litColor, '#ffffff', RIM_BRIGHTEN_TOWARD_WHITE), flooredDark, s);
    const mid = this.mixHex(lit, flooredDark, 0.55);
    const extent = radius * 1.15;
    return {
      from: { x: -localLightDir.x * extent, y: -localLightDir.y * extent },
      to: { x: localLightDir.x * extent, y: localLightDir.y * extent },
      stops: [
        { offset: 0, color: rim },
        { offset: 0.12, color: lit },
        { offset: 0.5, color: mid },
        { offset: 1, color: flooredDark },
      ],
    };
  }

  private raiseToFloor(hex: string): string {
    const rgb = parseHex(hex);
    if (!rgb) return hex;
    const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    if (luminance >= MIN_DARK_LUMINANCE) return hex;
    const scaleUp = MIN_DARK_LUMINANCE / Math.max(luminance, 0.0001);
    return toHex({
      r: Math.min(255, Math.round(rgb.r * scaleUp)),
      g: Math.min(255, Math.round(rgb.g * scaleUp)),
      b: Math.min(255, Math.round(rgb.b * scaleUp)),
    });
  }

  private mixHex(a: string, b: string, t: number): string {
    const ra = parseHex(a);
    const rb = parseHex(b);
    if (!ra || !rb) return t < 0.5 ? a : b;
    return toHex({
      r: Math.round(ra.r + (rb.r - ra.r) * t),
      g: Math.round(ra.g + (rb.g - ra.g) * t),
      b: Math.round(ra.b + (rb.b - ra.b) * t),
    });
  }
}

interface Rgb { r: number; g: number; b: number }

function parseHex(color: string): Rgb | null {
  const trimmed = color.trim();
  if (trimmed.length === 7 && trimmed[0] === '#') {
    const r = parseInt(trimmed.slice(1, 3), 16);
    const g = parseInt(trimmed.slice(3, 5), 16);
    const b = parseInt(trimmed.slice(5, 7), 16);
    if ([r, g, b].every((n) => !Number.isNaN(n))) return { r, g, b };
  }
  if (trimmed.length === 4 && trimmed[0] === '#') {
    const r = parseInt(trimmed[1] + trimmed[1], 16);
    const g = parseInt(trimmed[2] + trimmed[2], 16);
    const b = parseInt(trimmed[3] + trimmed[3], 16);
    if ([r, g, b].every((n) => !Number.isNaN(n))) return { r, g, b };
  }
  return null;
}

function toHex(rgb: Rgb): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}
