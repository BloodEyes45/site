import { clamp } from './utils.js';

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const FALLBACK_TILE_URL = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

const DEG = Math.PI / 180;

function project(lat, lon, zoom) {
  const n = 2 ** zoom;
  const sin = Math.sin(clamp(lat, -85.0511, 85.0511) * DEG);
  return {
    x: ((lon + 180) / 360) * n * TILE_SIZE,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n * TILE_SIZE,
  };
}

function unproject(x, y, zoom) {
  const n = 2 ** zoom;
  const world = n * TILE_SIZE;
  const lon = ((x % world) / world) * 360 - 180;
  const ny = Math.PI - (2 * Math.PI * y) / world;
  const lat = Math.atan(Math.sinh(ny)) / DEG;
  return {
    lat: clamp(lat, -85.0511, 85.0511),
    lon: ((lon + 540) % 360) - 180,
  };
}

function tileUrl(z, x, y) {
  return TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
}

export class TileMap {
  constructor(element, options = {}) {
    this.el = element;
    this.lat = Number(options.lat ?? 41.0151);
    this.lon = Number(options.lon ?? 28.9795);
    this.zoom = clamp(Number(options.zoom ?? 13), MIN_ZOOM, MAX_ZOOM);
    this.interactive = options.interactive !== false;
    this.showPin = options.showPin !== false;
    this.theme = options.theme || document.documentElement.dataset.theme || 'light';
    this.onMove = options.onMove || null;
    this.onUserMove = options.onUserMove || null;
    this.marker = options.marker
      ? { lat: Number(options.marker.lat), lon: Number(options.marker.lon) }
      : this.showPin
        ? { lat: this.lat, lon: this.lon }
        : null;
    this.markerScreen = null;
    this.destroyed = false;
    this.pointers = new Map();
    this.drag = null;
    this.pinch = null;
    this.tiles = new Map();
    this.tileUrl = options.tileUrl || TILE_URL;
    this.fallbackUrl = options.fallbackUrl || FALLBACK_TILE_URL;
    this.usedFallback = false;
    this.tileErrors = 0;

    this.el.classList.add('tile-map');
    this.el.innerHTML = `
      <div class="tile-map__canvas" aria-hidden="true">
        <div class="tile-map__layer"></div>
      </div>
      ${this.showPin ? '<div class="tile-map__pin" aria-hidden="true"><span></span></div>' : ''}
      <div class="tile-map__attribution">© OpenStreetMap · CARTO</div>
    `;
    this.layer = this.el.querySelector('.tile-map__layer');
    this.canvas = this.el.querySelector('.tile-map__canvas');
    this.markerElement = this.el.querySelector('.tile-map__pin');

    this.resizeObserver = new ResizeObserver(() => this.invalidate());
    this.resizeObserver.observe(this.el);

    this.bind();
    requestAnimationFrame(() => this.invalidate());
  }

  bind() {
    if (!this.interactive) return;

    this.el.tabIndex = 0;
    this.el.setAttribute('role', 'application');
    this.el.setAttribute('aria-label', 'Harita. Sürükleyerek gez, artı ve eksi ile yakınlaş.');

    this.onPointerDown = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      this.el.setPointerCapture?.(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.pointers.size === 1) {
        this.drag = {
          id: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          dx: 0,
          dy: 0,
        };
        this.el.classList.add('is-dragging');
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          zoom: this.zoom,
        };
        this.drag = null;
        this.layer.style.transform = '';
      }
    };

    this.onPointerMove = (event) => {
      if (!this.pointers.has(event.pointerId)) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.pointers.size >= 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const ratio = distance / Math.max(1, this.pinch.distance);
        if (ratio > 1.35 && this.zoom < MAX_ZOOM) {
          this.zoom += 1;
          this.pinch = { distance, zoom: this.zoom };
          this.layer.style.transform = '';
          this.render();
        } else if (ratio < 0.74 && this.zoom > MIN_ZOOM) {
          this.zoom -= 1;
          this.pinch = { distance, zoom: this.zoom };
          this.layer.style.transform = '';
          this.render();
        }
        return;
      }

      if (!this.drag || this.drag.id !== event.pointerId) return;
      this.drag.dx = event.clientX - this.drag.startX;
      this.drag.dy = event.clientY - this.drag.startY;
      this.layer.style.transform = `translate3d(${this.drag.dx}px, ${this.drag.dy}px, 0)`;
      this.positionMarker(this.drag.dx, this.drag.dy);
    };

    this.endPointer = (event) => {
      if (!this.pointers.has(event.pointerId)) return;
      this.pointers.delete(event.pointerId);

      if (this.drag && this.drag.id === event.pointerId) {
        const { dx, dy } = this.drag;
        this.drag = null;
        this.layer.style.transform = '';
        this.el.classList.remove('is-dragging');
        if (Math.abs(dx) + Math.abs(dy) > 2) {
          const center = project(this.lat, this.lon, this.zoom);
          const next = unproject(center.x - dx, center.y - dy, this.zoom);
          this.lat = next.lat;
          this.lon = next.lon;
          this.render();
          this.emitMove();
          this.onUserMove?.({ reason: 'drag' });
        }
      }

      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 0) {
        this.el.classList.remove('is-dragging');
      }
    };

    this.el.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    this.el.addEventListener('pointermove', this.onPointerMove);
    this.el.addEventListener('pointerup', this.endPointer);
    this.el.addEventListener('pointercancel', this.endPointer);

    this.onWheel = (event) => {
      event.preventDefault();
      this.wheelZoom(event.deltaY);
    };
    this.el.addEventListener('wheel', this.onWheel, { passive: false });

    this.onDoubleClick = (event) => {
      event.preventDefault();
      this.zoomIn();
    };
    this.el.addEventListener('dblclick', this.onDoubleClick);

    this.onKeyDown = (event) => {
      const step = 70;
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        this.zoomIn();
      } else if (event.key === '-') {
        event.preventDefault();
        this.zoomOut();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.panBy(-step, 0);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.panBy(step, 0);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.panBy(0, -step);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.panBy(0, step);
      }
    };
    this.el.addEventListener('keydown', this.onKeyDown);
  }

  wheelZoom(delta) {
    const now = Date.now();
    if (now - (this.lastWheel || 0) < 220) return;
    this.lastWheel = now;
    if (delta < 0) this.zoomIn();
    else this.zoomOut();
  }

  panBy(dx, dy) {
    if (this.destroyed) return;
    const center = project(this.lat, this.lon, this.zoom);
    const next = unproject(center.x + dx, center.y + dy, this.zoom);
    this.lat = next.lat;
    this.lon = next.lon;
    this.render();
    this.emitMove();
    this.onUserMove?.({ reason: 'keyboard' });
  }

  zoomIn() {
    if (this.zoom >= MAX_ZOOM) return;
    this.zoom += 1;
    this.render();
    this.emitMove();
  }

  zoomOut() {
    if (this.zoom <= MIN_ZOOM) return;
    this.zoom -= 1;
    this.render();
    this.emitMove();
  }

  setView(lat, lon, zoom = this.zoom, notify = true) {
    this.lat = clamp(Number(lat), -85.0511, 85.0511);
    this.lon = Number(lon);
    this.zoom = clamp(Number(zoom), MIN_ZOOM, MAX_ZOOM);
    this.render();
    if (notify) this.emitMove();
  }

  setTheme(theme) {
    if (this.theme === theme) return;
    this.theme = theme;
    this.render();
  }

  urlFor(x, y) {
    const template = this.usedFallback ? this.fallbackUrl : this.tileUrl;
    return template.replace('{z}', this.zoom).replace('{x}', x).replace('{y}', y);
  }

  handleTileError(img) {
    if (this.destroyed) return;
    this.tileErrors += 1;
    img.classList.add('is-error');
    if (!img.dataset.retried) {
      img.dataset.retried = '1';
      const source = img.src;
      setTimeout(() => {
        if (this.destroyed || !img.isConnected) return;
        img.classList.remove('is-error');
        img.src = `${source}${source.includes('?') ? '&' : '?'}retry=1`;
      }, 1400);
      return;
    }
    if (!this.usedFallback && this.fallbackUrl && this.tileErrors >= 3) {
      this.usedFallback = true;
      this.tiles.clear();
      this.layer.replaceChildren();
      this.render();
      return;
    }
    this.el.classList.add('has-tile-error');
  }

  setMarker(lat, lon) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return;
    this.marker = { lat: Number(lat), lon: Number(lon) };
    if (!this.markerElement) return;
    const width = this.el.clientWidth;
    const height = this.el.clientHeight;
    if (!width || !height) return;
    const center = project(this.lat, this.lon, this.zoom);
    const left = center.x - width / 2;
    const top = center.y - height / 2;
    const marker = project(this.marker.lat, this.marker.lon, this.zoom);
    this.markerScreen = { x: marker.x - left, y: marker.y - top };
    this.positionMarker();
  }

  positionMarker(offsetX = 0, offsetY = 0) {
    if (!this.markerElement || !this.markerScreen) return;
    this.markerElement.style.left = `${this.markerScreen.x + offsetX}px`;
    this.markerElement.style.top = `${this.markerScreen.y + offsetY}px`;
  }

  getCenter() {
    return { lat: this.lat, lon: this.lon, zoom: this.zoom };
  }

  emitMove() {
    if (!this.onMove) return;
    this.onMove({ ...this.getCenter() });
  }

  invalidate() {
    if (this.destroyed) return;
    const { width, height } = this.el.getBoundingClientRect();
    if (!width || !height) return;
    this.render();
  }

  render() {
    if (this.destroyed || !this.layer) return;
    const width = this.el.clientWidth;
    const height = this.el.clientHeight;
    if (!width || !height) return;

    const zoom = this.zoom;
    const count = 2 ** zoom;
    const center = project(this.lat, this.lon, zoom);
    const left = center.x - width / 2;
    const top = center.y - height / 2;
    const startX = Math.floor(left / TILE_SIZE) - 1;
    const endX = Math.floor((left + width) / TILE_SIZE) + 1;
    const startY = Math.max(0, Math.floor(top / TILE_SIZE) - 1);
    const endY = Math.min(count - 1, Math.floor((top + height) / TILE_SIZE) + 1);

    if (!this.tiles) this.tiles = new Map();
    const wanted = new Map();
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        const wrappedX = ((x % count) + count) % count;
        const key = `${zoom}/${wrappedX}/${y}`;
        let img = this.tiles.get(key);
        if (!img) {
          img = document.createElement('img');
          img.className = 'tile-map__tile';
          img.alt = '';
          img.draggable = false;
          img.decoding = 'async';
          img.loading = 'eager';
          img.dataset.key = key;
          img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
          img.addEventListener('error', () => this.handleTileError(img));
          img.src = this.urlFor(wrappedX, y);
          this.tiles.set(key, img);
        }
        img.style.transform = `translate3d(${x * TILE_SIZE - left}px, ${y * TILE_SIZE - top}px, 0)`;
        wanted.set(key, img);
      }
    }

    // Artık görünmeyen karoları kaldır; kalanları yeniden indirme.
    for (const [key, img] of this.tiles) {
      if (!wanted.has(key)) {
        img.remove();
        this.tiles.delete(key);
      }
    }

    const fragment = document.createDocumentFragment();
    wanted.forEach((img) => {
      if (!img.isConnected) fragment.appendChild(img);
    });
    if (fragment.childNodes.length) this.layer.appendChild(fragment);

    if (this.marker && this.markerElement) {
      const marker = project(this.marker.lat, this.marker.lon, zoom);
      this.markerScreen = {
        x: marker.x - left,
        y: marker.y - top,
      };
      this.positionMarker();
    }
  }

  destroy() {
    this.destroyed = true;
    this.tiles?.clear();
    this.resizeObserver?.disconnect();
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    this.el.removeEventListener('pointermove', this.onPointerMove);
    this.el.removeEventListener('pointerup', this.endPointer);
    this.el.removeEventListener('pointercancel', this.endPointer);
    this.el.removeEventListener('wheel', this.onWheel);
    this.el.removeEventListener('dblclick', this.onDoubleClick);
    this.el.removeEventListener('keydown', this.onKeyDown);
    this.el.classList.remove('tile-map', 'is-dragging');
    this.el.removeAttribute('tabindex');
    this.el.removeAttribute('role');
    this.el.innerHTML = '';
  }
}

export function createMap(element, options) {
  if (!element) return null;
  if (element._tileMap) element._tileMap.destroy();
  const map = new TileMap(element, options);
  element._tileMap = map;
  return map;
}


