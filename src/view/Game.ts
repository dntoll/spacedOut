import { clamp, length, sub } from '../math';
import type * as Model from '../model';
import type { Vec2 } from '../types';
import { CollisionEffects } from './CollisionEffects';
import { ExhaustTrail } from './ExhaustTrail';
import { StarField } from './StarField';

export class Game implements Model.CollisionObserver {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private zoom = 1;
  private readonly starField = new StarField();
  private readonly exhaustTrail = new ExhaustTrail();
  private readonly collisionEffects = new CollisionEffects();
  private cameraPosition: Vec2 = { x: 0, y: 0 };
  private pointerPosition: Vec2 = { x: 0, y: 0 };
  private playerThrusting = false;

  private canvas: HTMLCanvasElement;
  private speedNode = document.querySelector<HTMLElement>('#speed');
  private hintNode = document.querySelector<HTMLElement>('#hint');

  constructor(canvasSelector: string) {
    const canvas = document.querySelector<HTMLCanvasElement>(canvasSelector);
    if (!canvas) throw new Error(`Canvas not found: ${canvasSelector}`);
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable');
    this.ctx = context;
    this.resize();
    this.pointerPosition = { x: this.width / 2, y: this.height / 2 - 100 };
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
  }

  get isPlayerThrusting(): boolean { return this.playerThrusting; }

  onCollision(collision: Model.Collision): void {
    this.collisionEffects.emit(collision);
  }

  getThrustTarget(): Vec2 {
    return {
      x: this.cameraPosition.x + (this.pointerPosition.x - this.width / 2) / this.zoom,
      y: this.cameraPosition.y + (this.pointerPosition.y - this.height / 2) / this.zoom,
    };
  }

  render(model: Model.Game, dt: number): void {
    this.cameraPosition = { ...model.ship.position };
    this.exhaustTrail.update(dt, model.ship);
    this.collisionEffects.update(dt);
    const targetZoom = clamp(1.15 - model.speed / 700, 0.42, 1.15);
    this.zoom += (targetZoom - this.zoom) * Math.min(1, dt * 2.5);
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#04070f';
    c.fillRect(0, 0, this.width, this.height);
    this.starField.draw(c, this.width, this.height, this.cameraPosition);

    c.save();
    c.translate(this.width / 2, this.height / 2);
    c.scale(this.zoom, this.zoom);
    c.translate(-model.ship.position.x, -model.ship.position.y);
    this.drawExhaust();
    this.collisionEffects.draw(c);
    model.asteroidBelt.forEach((asteroid) => this.drawAsteroid(asteroid, model.ship.position));
    this.drawShip(model);
    c.restore();
    this.drawVignette();
    if (this.speedNode) this.speedNode.textContent = Math.round(model.speed).toString().padStart(3, '0');
  }

  private bindInput(): void {
    const updatePointer = (event: PointerEvent): void => {
      event.preventDefault();
      this.pointerPosition = { x: event.clientX, y: event.clientY };
    };
    this.canvas.addEventListener('pointermove', updatePointer);
    this.canvas.addEventListener('pointerdown', (event) => {
      updatePointer(event);
      this.playerThrusting = true;
      this.hintNode?.classList.add('hidden');
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointerup', (event) => {
      this.playerThrusting = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointercancel', () => { this.playerThrusting = false; });
    window.addEventListener('blur', () => { this.playerThrusting = false; });
  }

  private resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.starField.resize(this.width, this.height);
  }

  private drawExhaust(): void {
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    this.exhaustTrail.forEach((p) => {
      const t = p.life / p.maxLife;
      c.beginPath();
      c.fillStyle = t > 0.55 ? `rgba(160,245,255,${t})` : `rgba(63,135,255,${t * 0.65})`;
      c.arc(p.position.x, p.position.y, p.size * t, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();
  }

  private drawAsteroid(a: Model.Asteroid, shipPosition: Vec2): void {
    const visibleRange = Math.hypot(this.width, this.height) / this.zoom * 0.7 + 100;
    if (length(sub(a.position, shipPosition)) > visibleRange) return;
    const c = this.ctx;
    c.save();
    c.translate(a.position.x, a.position.y);
    c.rotate(a.angle);
    c.beginPath();
    a.vertices.forEach((v, i) => {
      const angle = (i / a.vertices.length) * Math.PI * 2;
      const r = a.radius * v;
      if (i === 0) c.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else c.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    });
    c.closePath();
    const gradient = c.createRadialGradient(-a.radius * 0.32, -a.radius * 0.38, 0, 0, 0, a.radius * 1.2);
    gradient.addColorStop(0, a.shade > 0.5 ? '#536175' : '#424d5f');
    gradient.addColorStop(0.48, '#242d3d');
    gradient.addColorStop(1, '#0b101b');
    c.fillStyle = gradient;
    c.fill();
    c.strokeStyle = 'rgba(142,174,208,.38)';
    c.lineWidth = 1.3 / this.zoom;
    c.stroke();
    c.beginPath();
    c.arc(-a.radius * 0.22, -a.radius * 0.05, a.radius * 0.16, 0, Math.PI * 2);
    c.fillStyle = 'rgba(4,7,15,.3)'; c.fill();
    c.restore();
  }

  private drawShip(model: Model.Game): void {
    const s = model.ship, c = this.ctx;
    c.save();
    c.translate(s.position.x, s.position.y);
    c.rotate(s.angle);
    if (model.thrusting) {
      const glow = c.createRadialGradient(-15, 0, 0, -15, 0, 35);
      glow.addColorStop(0, `rgba(100,230,255,${0.25 + model.thrustAmount * 0.5})`); glow.addColorStop(1, 'rgba(20,90,255,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(-15, 0, 35, 0, Math.PI * 2); c.fill();
    }
    c.shadowColor = '#7ee9ff'; c.shadowBlur = 15;
    c.beginPath(); c.moveTo(22, 0); c.lineTo(-14, 13); c.lineTo(-8, 0); c.lineTo(-14, -13); c.closePath();
    c.fillStyle = '#d9f7ff'; c.fill();
    c.shadowBlur = 0; c.strokeStyle = '#72dff5'; c.lineWidth = 1.4; c.stroke();
    c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, 5); c.lineTo(-4, -5); c.closePath(); c.fillStyle = '#182c45'; c.fill();
    c.restore();
  }

  private drawVignette(): void {
    const c = this.ctx;
    const g = c.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.18, this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,4,12,.72)');
    c.fillStyle = g; c.fillRect(0, 0, this.width, this.height);
  }
}
