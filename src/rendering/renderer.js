import { readyImage } from '../core/assets.js';
import { deformPoint } from '../simulations/deformation.js';
import { CONFIG } from '../config.js';
export class SimulationRenderer {
  constructor(engine) {
    this.engine = engine;
    this.shadow = null;
    this.textures = new WeakMap();
    this.shards = new WeakMap();
    this.symbols = new Map();
    this.mesh = new Float32Array(17 * 17 * 2);
    this.point = { x: 0, y: 0 };
  }
  _canvas(width, height = width) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  _texture(image, size) {
    let texture = this.textures.get(image);
    if (!texture) {
      texture = this._canvas(size * CONFIG.view.maxDpr);
      texture
        .getContext('2d')
        .drawImage(image, 0, 0, texture.width, texture.height);
      this.textures.set(image, texture);
    }
    return texture;
  }
  draw(ctx) {
    ctx.clearRect(0, 0, this.engine.width, this.engine.height);

    if (this.engine.mode === 'squishy') {
      this._drawSquishy(ctx);
    } else {
      this._drawWaxObject(ctx);
      this._drawParticles(ctx);
    }
  }

  /**
   * Draws the main Wax image scaling dynamically
   */
  _drawWaxObject(ctx) {
    const sq = this.engine.squishy;
    ctx.save();
    ctx.translate(sq.x, sq.y);
    ctx.scale(sq.scaleX, sq.scaleY);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const size = sq.baseRadius * 2;
    const activeImage =
      this.engine.customImages[this.engine.currentWaxImage] ||
      this.engine.customImages.wax;

    if (readyImage(activeImage)) {
      ctx.drawImage(
        this._texture(activeImage, size),
        -size / 2,
        -size / 2,
        size,
        size,
      );
    } else {
      const grad = ctx.createRadialGradient(
        -15,
        -25,
        sq.baseRadius * 0.1,
        0,
        0,
        sq.baseRadius,
      );
      grad.addColorStop(0, '#ffa3c0');
      grad.addColorStop(0.5, '#cc3f6c');
      grad.addColorStop(1, '#590d22');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, sq.baseRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('왁뿌!', 0, -10);
      ctx.font = '11px sans-serif';
      ctx.fillText('터치해서 바삭하게', 0, 15);
    }

    ctx.restore();
  }

  /**
   * Draws squishy mochi toy with soft silicone drop-shadow & particles
   */
  _drawSquishy(ctx) {
    const sq = this.engine.squishyObj;
    const currentCenterX = sq.x + sq.offsetX;
    const currentCenterY = sq.y + sq.offsetY;
    const size = sq.baseRadius * 2;

    // 1. Draw soft contact shadow on floor
    ctx.save();
    ctx.translate(sq.x, sq.y + sq.baseRadius * 0.82);
    // Shadow widens as squishy gets compressed
    const shadowScaleX = sq.scaleX * 1.05 + Math.abs(sq.offsetX) * 0.005;
    const shadowScaleY = Math.max(0.2, (2.0 - sq.scaleY) * 0.28);
    ctx.scale(shadowScaleX, shadowScaleY);

    if (!this.shadow) {
      this.shadow = document.createElement('canvas');
      this.shadow.width = this.shadow.height = 300;
      const sc = this.shadow.getContext('2d');
      const g = sc.createRadialGradient(150, 150, 10, 150, 150, 145);
      g.addColorStop(0, 'rgba(0,0,0,.18)');
      g.addColorStop(0.6, 'rgba(0,0,0,.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sc.fillStyle = g;
      sc.fillRect(0, 0, 300, 300);
    }
    ctx.drawImage(this.shadow, -150, -150, 300, 300);
    ctx.restore();

    // 2. Draw Squishy Character with Elastic Transformation
    ctx.save();
    ctx.translate(currentCenterX, currentCenterY);
    ctx.rotate(sq.rotation);
    ctx.scale(sq.scaleX, sq.scaleY);

    const activeImg = this.engine.squishyImages[this.engine.squishyCharacter];
    let texture;
    if (readyImage(activeImg)) {
      texture = this._texture(activeImg, size);
    } else {
      const key = `fallback:${this.engine.squishyCharacter}`;
      texture = this.symbols.get(key);
      if (!texture) {
        texture = this._canvas(size * CONFIG.view.maxDpr);
        const fallback = texture.getContext('2d');
        fallback.scale(CONFIG.view.maxDpr, CONFIG.view.maxDpr);
        fallback.translate(size / 2, size / 2);
        // Fallback cute placeholder
        fallback.fillStyle =
          this.engine.squishyCharacter === 'cat_paw' ? '#ffccd5' : '#f8f9fa';
        fallback.beginPath();
        fallback.arc(0, 0, sq.baseRadius, 0, Math.PI * 2);
        fallback.fill();
        fallback.fillStyle = '#ff4d6d';
        fallback.font = 'bold 20px Outfit, sans-serif';
        fallback.textAlign = 'center';
        fallback.fillText(
          this.engine.squishyCharacter === 'cat_paw'
            ? '🐾 고양이 발바닥'
            : '🐰 말랑 토끼',
          0,
          0,
        );
        this.symbols.set(key, texture);
      }
    }
    this._drawPressedTexture(ctx, texture, size, sq);

    ctx.restore();

    // 3. Draw ASMR Floating Particles
    this._drawSquishyParticles(ctx);
  }

  _drawPressedTexture(ctx, texture, size, sq) {
    const half = size / 2;
    if (sq.pressure < 0.001) {
      ctx.drawImage(texture, -half, -half, size, size);
      return;
    }
    const cells = 16,
      stride = cells + 1,
      step = size / cells;
    const mesh = this.mesh;
    for (let row = 0; row <= cells; row++) {
      for (let col = 0; col <= cells; col++) {
        const i = (row * stride + col) * 2;
        deformPoint(
          col * step - half,
          row * step - half,
          sq.pressX,
          sq.pressY,
          sq.pressure,
          this.point,
        );
        mesh[i] = this.point.x;
        mesh[i + 1] = this.point.y;
      }
    }
    const ratio = texture.width / size;
    for (let row = 0; row < cells; row++) {
      let col = 0;
      while (col < cells) {
        const i = (row * stride + col) * 2;
        const x = col * step - half,
          y = row * step - half;
        // Unaffected cells share a single draw; only the contact patch is meshed.
        const affected =
          Math.hypot(x + step / 2 - sq.pressX, y + step / 2 - sq.pressY) <
          85 + step;
        if (!affected) {
          const start = col++;
          while (
            col < cells &&
            Math.hypot(
              col * step - half + step / 2 - sq.pressX,
              y + step / 2 - sq.pressY,
            ) >=
              85 + step
          )
            col++;
          const pad = 0.6;
          const left = Math.max(0, start * step - pad);
          const top = Math.max(0, row * step - pad);
          const right = Math.min(size, col * step + pad);
          const bottom = Math.min(size, (row + 1) * step + pad);
          ctx.drawImage(
            texture,
            left * ratio,
            top * ratio,
            (right - left) * ratio,
            (bottom - top) * ratio,
            left - half,
            top - half,
            right - left,
            bottom - top,
          );
          continue;
        }
        const right = i + 2,
          bottom = i + stride * 2,
          diagonal = bottom + 2;
        this._triangle(
          ctx,
          texture,
          col * step * ratio,
          row * step * ratio,
          step,
          ratio,
          mesh,
          i,
          right,
          bottom,
          false,
        );
        this._triangle(
          ctx,
          texture,
          col * step * ratio,
          row * step * ratio,
          step,
          ratio,
          mesh,
          diagonal,
          bottom,
          right,
          true,
        );
        col++;
      }
    }
  }

  _triangle(ctx, texture, sx, sy, step, ratio, mesh, a, b, c, reverse) {
    const sign = reverse ? -1 : 1;
    const ax = mesh[a],
      ay = mesh[a + 1];
    const bx = mesh[b],
      by = mesh[b + 1];
    const cx = mesh[c],
      cy = mesh[c + 1];
    const m11 = ((bx - ax) / step) * sign,
      m12 = ((by - ay) / step) * sign;
    const m21 = ((cx - ax) / step) * sign,
      m22 = ((cy - ay) / step) * sign;
    ctx.save();
    ctx.transform(
      m11,
      m12,
      m21,
      m22,
      ax - (reverse ? step * (m11 + m21) : 0),
      ay - (reverse ? step * (m12 + m22) : 0),
    );
    // A subpixel overlap hides antialiasing cracks along the shared mesh edges.
    ctx.beginPath();
    if (reverse) {
      ctx.moveTo(step + 0.6, step + 0.6);
      ctx.lineTo(-1.8, step + 0.6);
      ctx.lineTo(step + 0.6, -1.8);
    } else {
      ctx.moveTo(-0.6, -0.6);
      ctx.lineTo(step + 1.8, -0.6);
      ctx.lineTo(-0.6, step + 1.8);
    }
    ctx.closePath();
    ctx.clip();
    const pad = 0.6;
    const left = Math.max(0, sx - pad * ratio),
      top = Math.max(0, sy - pad * ratio);
    const right = Math.min(texture.width, sx + (step + pad) * ratio);
    const bottom = Math.min(texture.height, sy + (step + pad) * ratio);
    ctx.drawImage(
      texture,
      left,
      top,
      right - left,
      bottom - top,
      (left - sx) / ratio,
      (top - sy) / ratio,
      (right - left) / ratio,
      (bottom - top) / ratio,
    );
    ctx.restore();
  }

  /**
   * Draws cute hearts, stars and bubbles floating from squishy
   */
  _drawSquishyParticles(ctx) {
    this.engine.squishyParticles.forEach((p) => {
      const key = `${p.symbol}:${p.color}`;
      let sprite = this.symbols.get(key);
      if (!sprite) {
        sprite = this._canvas(96);
        const sc = sprite.getContext('2d');
        sc.scale(2, 2);
        sc.fillStyle = sc.shadowColor = p.color;
        sc.font = 'bold 24px sans-serif';
        sc.textAlign = 'center';
        sc.textBaseline = 'middle';
        sc.shadowBlur = 6;
        sc.fillText(p.symbol, 24, 24);
        this.symbols.set(key, sprite);
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.life;
      const size = p.size * 2;
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    });
  }

  /**
   * Draws flying particles for wax mode
   */
  _drawParticles(ctx) {
    this.engine.particles.forEach((p) => {
      let sprite = this.shards.get(p);
      if (!sprite) {
        sprite = this._shardSprite(p);
        this.shards.set(p, sprite);
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      ctx.globalAlpha = p.life;
      ctx.drawImage(
        sprite.canvas,
        sprite.x,
        sprite.y,
        sprite.width,
        sprite.height,
      );
      ctx.restore();
    });
  }

  _shardSprite(p) {
    const x = Math.floor(Math.min(...p.vertices.map((v) => v.x))) - 4;
    const y = Math.floor(Math.min(...p.vertices.map((v) => v.y))) - 4;
    const width = Math.ceil(Math.max(...p.vertices.map((v) => v.x))) - x + 4;
    const height = Math.ceil(Math.max(...p.vertices.map((v) => v.y))) - y + 4;
    const canvas = this._canvas(width * 2, height * 2);
    const sc = canvas.getContext('2d');
    sc.scale(2, 2);
    sc.translate(-x, -y);
    sc.beginPath();
    sc.moveTo(p.vertices[0].x, p.vertices[0].y);
    sc.lineTo(p.vertices[1].x, p.vertices[1].y);
    sc.lineTo(p.vertices[2].x, p.vertices[2].y);
    sc.closePath();
    sc.shadowColor = 'rgba(0,0,0,.1)';
    sc.shadowBlur = 3;
    sc.shadowOffsetY = 1;
    sc.fillStyle = '#cc3f6c';
    sc.fill();
    sc.shadowBlur = 0;
    if (readyImage(p.texture)) {
      const size = this.engine.squishy.baseRadius * 2;
      sc.save();
      sc.clip();
      sc.clearRect(x, y, width, height);
      sc.drawImage(
        this._texture(p.texture, size),
        -p.localCentroid.x - size / 2,
        -p.localCentroid.y - size / 2,
        size,
        size,
      );
      sc.restore();
    }
    sc.strokeStyle = 'rgba(255,255,255,.3)';
    sc.lineWidth = 0.8;
    sc.stroke();
    return { canvas, x, y, width, height };
  }
}
