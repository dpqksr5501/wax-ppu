import { readyImage } from '../core/assets.js';
export class SimulationRenderer {
  constructor(engine) {
    this.engine = engine;
    this.shadow = null;
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
      ctx.drawImage(activeImage, -size / 2, -size / 2, size, size);
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

    if (readyImage(activeImg)) {
      ctx.drawImage(activeImg, -size / 2, -size / 2, size, size);
    } else {
      // Fallback cute placeholder
      ctx.fillStyle =
        this.engine.squishyCharacter === 'cat_paw' ? '#ffccd5' : '#f8f9fa';
      ctx.beginPath();
      ctx.arc(0, 0, sq.baseRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff4d6d';
      ctx.font = 'bold 20px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        this.engine.squishyCharacter === 'cat_paw'
          ? '🐾 고양이 발바닥'
          : '🐰 말랑 토끼',
        0,
        0,
      );
    }

    ctx.restore();

    // 3. Draw ASMR Floating Particles
    this._drawSquishyParticles(ctx);
  }

  /**
   * Draws cute hearts, stars and bubbles floating from squishy
   */
  _drawSquishyParticles(ctx) {
    this.engine.squishyParticles.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.font = `bold ${p.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillText(p.symbol, 0, 0);
      ctx.restore();
    });
  }

  /**
   * Draws flying particles for wax mode
   */
  _drawParticles(ctx) {
    this.engine.particles.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      ctx.beginPath();
      ctx.moveTo(p.vertices[0].x, p.vertices[0].y);
      ctx.lineTo(p.vertices[1].x, p.vertices[1].y);
      ctx.lineTo(p.vertices[2].x, p.vertices[2].y);
      ctx.closePath();

      ctx.globalAlpha = p.life;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;

      const activeImage = p.texture;
      const size = this.engine.squishy.baseRadius * 2;

      if (readyImage(activeImage)) {
        ctx.save();
        ctx.clip();
        ctx.drawImage(
          activeImage,
          -p.localCentroid.x - size / 2,
          -p.localCentroid.y - size / 2,
          size,
          size,
        );
        ctx.restore();
      } else {
        ctx.fillStyle = '#cc3f6c';
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.restore();
    });
  }
}
