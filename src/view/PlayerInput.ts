import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing } from './Drawing';

export class PlayerInput {
  private pointerPosition: Vec2;
  private thrusting = false;
  private readonly keys = new Set<string>();

  constructor(private drawing: Drawing, onFirstThrust: () => void) {
    const { width, height } = drawing.size;
    this.pointerPosition = { x: width / 2, y: height / 2 - 100 };

    drawing.onPointerMove((pointer) => { this.pointerPosition = pointer; });
    drawing.onPointerDown((pointer) => {
      this.pointerPosition = pointer;
      if (pointer.pointerType === 'touch') {
        this.thrusting = true;
        onFirstThrust();
      }
      drawing.capturePointer(pointer.pointerId);
    });
    drawing.onPointerUp((pointer) => {
      this.thrusting = false;
      drawing.releasePointer(pointer.pointerId);
    });
    drawing.onPointerCancel(() => { this.thrusting = false; });
    drawing.onBlur(() => { this.thrusting = false; this.keys.clear(); });

    drawing.onKeyDown((key) => { this.keys.add(key.toLowerCase()); if (this.isDirectionalThrusting) onFirstThrust(); });
    drawing.onKeyUp((key) => { this.keys.delete(key.toLowerCase()); });
  }

  get isThrusting(): boolean { return this.thrusting; }
  get isDirectionalThrusting(): boolean { return this.getDirectionalVector() !== null; }

  getDirectionalThrust(): Vec2 | null { return this.getDirectionalVector(); }
  getTarget(camera: Camera): Vec2 { return camera.screenToWorld(this.pointerPosition, this.drawing.size); }

  private getDirectionalVector(): Vec2 | null {
    let x = 0;
    let y = 0;
    if (this.keys.has('w')) x += 1;
    if (this.keys.has('s')) x -= 1;
    if (this.keys.has('d')) y += 1;
    if (this.keys.has('a')) y -= 1;
    if (x === 0 && y === 0) return null;
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }
}
