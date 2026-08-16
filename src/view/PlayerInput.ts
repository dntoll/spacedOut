import type { Vec2 } from '../types';
import type { Camera } from './Camera';
import type { Drawing } from './Drawing';

export class PlayerInput {
  private pointerPosition: Vec2;
  private thrusting = false;

  constructor(private drawing: Drawing, onFirstThrust: () => void) {
    const { width, height } = drawing.size;
    this.pointerPosition = { x: width / 2, y: height / 2 - 100 };

    drawing.onPointerMove((pointer) => { this.pointerPosition = pointer; });
    drawing.onPointerDown((pointer) => {
      this.pointerPosition = pointer;
      this.thrusting = true;
      onFirstThrust();
      drawing.capturePointer(pointer.pointerId);
    });
    drawing.onPointerUp((pointer) => {
      this.thrusting = false;
      drawing.releasePointer(pointer.pointerId);
    });
    drawing.onPointerCancel(() => { this.thrusting = false; });
    drawing.onBlur(() => { this.thrusting = false; });
  }

  get isThrusting(): boolean { return this.thrusting; }
  getTarget(camera: Camera): Vec2 { return camera.screenToWorld(this.pointerPosition, this.drawing.size); }
}
