import { clamp } from './utils.js';

// Çizimler bu mantıksal kağıt ölçüsüne göre normalize edilir; ekran boyutu değişse de
// not aynı oranda görünür.
const PAPER_W = 900;
const PAPER_H = 1240;
const MIN_DISTANCE = 0.0012;
const MAX_UNDO = 40;

export const INK_COLORS = [
  { id: 'ink', value: '#2c2636', label: 'Mürekkep' },
  { id: 'blue', value: '#2f5fd0', label: 'Mavi' },
  { id: 'rose', value: '#d4547a', label: 'Gül' },
  { id: 'green', value: '#2f8f6b', label: 'Yeşil' },
  { id: 'violet', value: '#7b5bd6', label: 'Mor' },
];

export const INK_TOOLS = [
  { id: 'pen', label: 'Kalem' },
  { id: 'marker', label: 'Fosforlu' },
  { id: 'eraser', label: 'Silgi' },
];

function cloneStroke(stroke) {
  return {
    tool: stroke.tool === 'marker' ? 'marker' : 'pen',
    color: String(stroke.color || INK_COLORS[0].value),
    width: Number(stroke.width) || 2.6,
    points: Array.isArray(stroke.points)
      ? stroke.points.map((point) => [
          clamp(Number(point[0]) || 0, 0, 1),
          clamp(Number(point[1]) || 0, 0, 1),
          clamp(Number(point[2] ?? 0.6), 0, 1),
        ])
      : [],
  };
}

function strokeWidth(stroke, viewWidth) {
  const scale = Math.max(0.8, viewWidth / 430);
  return Math.max(0.7, stroke.width * scale);
}

function paintStroke(ctx, stroke, width, height) {
  const points = stroke.points;
  if (!points.length) return;
  const base = strokeWidth(stroke, width);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.globalAlpha = stroke.tool === 'marker' ? 0.34 : 1;

  if (points.length === 1) {
    const [x, y, p] = points[0];
    ctx.beginPath();
    ctx.arc(x * width, y * height, Math.max(0.8, base * (0.4 + p * 0.8)), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const next = points[index];
    const pressure = (Number(prev[2]) + Number(next[2])) / 2;
    ctx.lineWidth = Math.max(0.7, base * (0.38 + pressure * 1.15));
    ctx.beginPath();
    ctx.moveTo(prev[0] * width, prev[1] * height);
    const midX = ((prev[0] + next[0]) / 2) * width;
    const midY = ((prev[1] + next[1]) / 2) * height;
    ctx.quadraticCurveTo(midX, midY, next[0] * width, next[1] * height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintAll(ctx, strokes, width, height) {
  strokes.forEach((stroke) => paintStroke(ctx, stroke, width, height));
}

function pointDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export class InkSurface {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.strokes = Array.isArray(options.strokes) ? options.strokes.map(cloneStroke) : [];
    this.tool = options.tool || 'pen';
    this.color = options.color || INK_COLORS[0].value;
    this.width = Number(options.width) || 2.6;
    this.onChange = options.onChange || null;
    this.destroyed = false;
    this.active = null;
    this.penPointers = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.view = { width: 1, height: 1, dpr: 1 };

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.bind();
    this.resize();
  }

  bind() {
    this.onPointerDown = (event) => {
      if (this.destroyed) return;
      if (event.pointerType === 'touch' && this.penPointers.size > 0) return;
      if (event.pointerType === 'pen') this.penPointers.add(event.pointerId);
      if (event.pointerType !== 'pen' && event.isPrimary === false) return;
      if (event.button !== undefined && event.button > 0) return;
      event.preventDefault();
      try {
        this.canvas.setPointerCapture?.(event.pointerId);
      } catch {
        // Sentetik olaylarda pointer yakalama bulunmayabilir.
      }
      this.canvas.classList.add('is-drawing');

      this.snapshot();
      const point = this.pointFrom(event);
      if (this.tool === 'eraser') {
        this.active = { mode: 'erase', pointerId: event.pointerId };
        this.eraseAt(point);
        return;
      }
      const pressure = this.pressureFrom(event);
      this.active = {
        mode: 'draw',
        pointerId: event.pointerId,
        stroke: {
          tool: this.tool,
          color: this.color,
          width: this.width,
          points: [[point[0], point[1], pressure]],
        },
      };
      this.strokes.push(this.active.stroke);
      this.redoStack = [];
      this.render();
    };

    this.onPointerMove = (event) => {
      if (this.destroyed || !this.active || this.active.pointerId !== event.pointerId) return;
      event.preventDefault();
      const events = event.getCoalescedEvents ? event.getCoalescedEvents() : [];
      const samples = events.length ? events : [event];
      if (this.active.mode === 'erase') {
        samples.forEach((sample) => this.eraseAt(this.pointFrom(sample)));
        return;
      }
      const stroke = this.active.stroke;
      samples.forEach((sample) => {
        const point = this.pointFrom(sample);
        const last = stroke.points[stroke.points.length - 1];
        if (last && pointDistance(last, point) < MIN_DISTANCE) return;
        stroke.points.push([point[0], point[1], this.pressureFrom(sample)]);
      });
      this.render();
    };

    this.onPointerEnd = (event) => {
      if (event.pointerType === 'pen') this.penPointers.delete(event.pointerId);
      if (!this.active || this.active.pointerId !== event.pointerId) return;
      this.canvas.classList.remove('is-drawing');
      if (this.active.mode === 'draw' && this.active.stroke.points.length < 2) {
        // Tek dokunuşu da nokta olarak bırak.
        this.active.stroke.points.push([...this.active.stroke.points[0]]);
      }
      this.active = null;
      this.emit();
    };

    this.onPointerCancel = (event) => {
      if (event.pointerType === 'pen') this.penPointers.delete(event.pointerId);
      if (this.active && this.active.pointerId === event.pointerId) {
        this.active = null;
        this.canvas.classList.remove('is-drawing');
        this.emit();
      }
    };

    this.onContextMenu = (event) => event.preventDefault();

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerEnd);
    this.canvas.addEventListener('pointercancel', this.onPointerCancel);
    this.canvas.addEventListener('pointerleave', this.onPointerEnd);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  pointFrom(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = rect.width ? (event.clientX - rect.left) / rect.width : 0;
    const y = rect.height ? (event.clientY - rect.top) / rect.height : 0;
    return [clamp(x, 0, 1), clamp(y, 0, 1)];
  }

  pressureFrom(event) {
    if (event.pointerType !== 'pen') return 0.6;
    const pressure = Number(event.pressure);
    if (!Number.isFinite(pressure) || pressure <= 0) return 0.55;
    return clamp(0.18 + pressure * 0.95, 0.18, 1);
  }

  eraseAt(point) {
    const radius = 20 / Math.max(1, this.view.width);
    const before = this.strokes.length;
    this.strokes = this.strokes.filter(
      (stroke) => !stroke.points.some((item) => pointDistance(item, point) < radius),
    );
    if (this.strokes.length !== before) {
      this.render();
      this.emit();
    }
  }

  snapshot() {
    this.undoStack.push(this.strokes.map(cloneStroke));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
    this.emit();
  }

  resize() {
    if (this.destroyed) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const pixelWidth = Math.round(rect.width * dpr);
    const pixelHeight = Math.round(rect.height * dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.view = { width: rect.width, height: rect.height, dpr };
    this.render();
  }

  render() {
    if (this.destroyed) return;
    const { width, height, dpr } = this.view;
    if (!width || !height) return;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    paintAll(ctx, this.strokes, width, height);
  }

  setTool(tool) {
    this.tool = tool === 'marker' || tool === 'eraser' ? tool : 'pen';
    this.canvas.dataset.tool = this.tool;
  }

  setColor(color) {
    this.color = color || INK_COLORS[0].value;
    if (this.tool === 'eraser') this.tool = 'pen';
  }

  setWidth(width) {
    this.width = clamp(Number(width) || 2.6, 1, 9);
  }

  undo() {
    if (!this.undoStack.length) return false;
    this.redoStack.push(this.strokes.map(cloneStroke));
    this.strokes = this.undoStack.pop();
    this.render();
    this.emit();
    return true;
  }

  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(this.strokes.map(cloneStroke));
    this.strokes = this.redoStack.pop();
    this.render();
    this.emit();
    return true;
  }

  clear() {
    if (!this.strokes.length) return;
    this.snapshot();
    this.strokes = [];
    this.render();
    this.emit();
  }

  isEmpty() {
    return !this.strokes.some((stroke) => stroke.points.length > 0);
  }

  getStrokes() {
    return this.strokes.map(cloneStroke);
  }

  toDataUrl({ width = PAPER_W, height = PAPER_H, background = '#fffdf8', type = 'image/png', quality } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    paintAll(ctx, this.strokes, width, height);
    return canvas.toDataURL(type, quality);
  }

  thumbnail() {
    return this.toDataUrl({ width: 420, height: 578, type: 'image/jpeg', quality: 0.72 });
  }

  emit() {
    this.onChange?.(this.getStrokes());
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerEnd);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('pointerleave', this.onPointerEnd);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }
}
