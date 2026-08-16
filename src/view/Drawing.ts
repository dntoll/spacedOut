import type { Vec2 } from '../types';

export interface Size { width: number; height: number }
export interface PointerPosition extends Vec2 { pointerId: number }
export interface GradientStop { offset: number; color: string }
export interface RadialPaint {
  from: Vec2;
  fromRadius: number;
  to: Vec2;
  toRadius: number;
  stops: GradientStop[];
}
export type Paint = string | RadialPaint;

export class Drawing {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private viewport: Size = { width: 0, height: 0 };
  private pixelRatio = 1;

  constructor(canvasSelector: string) {
    const canvas = document.querySelector<HTMLCanvasElement>(canvasSelector);
    if (!canvas) throw new Error(`Canvas not found: ${canvasSelector}`);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable');
    this.canvas = canvas;
    this.context = context;
    this.resize();
  }

  get size(): Size { return { ...this.viewport }; }

  resize(): void {
    this.viewport = { width: window.innerWidth, height: window.innerHeight };
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.viewport.width * this.pixelRatio;
    this.canvas.height = this.viewport.height * this.pixelRatio;
    this.canvas.style.width = `${this.viewport.width}px`;
    this.canvas.style.height = `${this.viewport.height}px`;
  }

  clear(color: string): void {
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.context.fillStyle = color;
    this.context.fillRect(0, 0, this.viewport.width, this.viewport.height);
  }

  withCamera(position: Vec2, zoom: number, draw: () => void): void {
    this.withState(() => {
      this.context.translate(this.viewport.width / 2, this.viewport.height / 2);
      this.context.scale(zoom, zoom);
      this.context.translate(-position.x, -position.y);
      draw();
    });
  }

  withTransform(position: Vec2, angle: number, draw: () => void): void {
    this.withState(() => {
      this.context.translate(position.x, position.y);
      this.context.rotate(angle);
      draw();
    });
  }

  withAdditiveBlend(draw: () => void): void {
    this.withState(() => {
      this.context.globalCompositeOperation = 'lighter';
      draw();
    });
  }

  withShadow(color: string, blur: number, draw: () => void): void {
    this.withState(() => {
      this.context.shadowColor = color;
      this.context.shadowBlur = blur;
      draw();
    });
  }

  rectangle(position: Vec2, size: Size, fill: Paint): void {
    this.context.fillStyle = this.resolvePaint(fill);
    this.context.fillRect(position.x, position.y, size.width, size.height);
  }

  circle(position: Vec2, radius: number, fill: Paint): void {
    this.context.beginPath();
    this.context.arc(position.x, position.y, radius, 0, Math.PI * 2);
    this.context.fillStyle = this.resolvePaint(fill);
    this.context.fill();
  }

  polygon(points: Vec2[], fill: Paint, stroke?: string, lineWidth = 1): void {
    if (points.length === 0) return;
    this.context.beginPath();
    this.context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) this.context.lineTo(points[i].x, points[i].y);
    this.context.closePath();
    this.context.fillStyle = this.resolvePaint(fill);
    this.context.fill();
    if (stroke) {
      this.context.strokeStyle = stroke;
      this.context.lineWidth = lineWidth;
      this.context.stroke();
    }
  }

  onResize(listener: () => void): void { window.addEventListener('resize', listener); }
  onBlur(listener: () => void): void { window.addEventListener('blur', listener); }
  onPointerMove(listener: (pointer: PointerPosition) => void): void { this.onPointer('pointermove', listener); }
  onPointerDown(listener: (pointer: PointerPosition) => void): void { this.onPointer('pointerdown', listener); }
  onPointerUp(listener: (pointer: PointerPosition) => void): void { this.onPointer('pointerup', listener); }
  onPointerCancel(listener: () => void): void { this.canvas.addEventListener('pointercancel', listener); }
  capturePointer(pointerId: number): void { this.canvas.setPointerCapture(pointerId); }
  releasePointer(pointerId: number): void {
    if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
  }

  private withState(draw: () => void): void {
    this.context.save();
    draw();
    this.context.restore();
  }

  private resolvePaint(paint: Paint): string | CanvasGradient {
    if (typeof paint === 'string') return paint;
    const gradient = this.context.createRadialGradient(
      paint.from.x, paint.from.y, paint.fromRadius,
      paint.to.x, paint.to.y, paint.toRadius,
    );
    for (const stop of paint.stops) gradient.addColorStop(stop.offset, stop.color);
    return gradient;
  }

  private onPointer(type: 'pointermove' | 'pointerdown' | 'pointerup', listener: (pointer: PointerPosition) => void): void {
    this.canvas.addEventListener(type, (event) => {
      event.preventDefault();
      listener({ x: event.clientX, y: event.clientY, pointerId: event.pointerId });
    });
  }
}
