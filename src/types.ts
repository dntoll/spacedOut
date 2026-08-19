export interface Vec2 { x: number; y: number }

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ControlTuning {
  dampening: number;
  thrustAccel: number;
  maxSpeed: number;
}

export interface DirectionalThrust {
  vec: Vec2;
  level: number;
}
