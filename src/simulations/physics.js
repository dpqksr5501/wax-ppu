import { CONFIG, CRACKS, FEELS } from '../config.js';
import { loadTexture } from '../core/assets.js';
import { SimulationRenderer } from '../rendering/renderer.js';
const SETTLE_AXES = [
  ['scaleX', 'targetScaleX', 'vx'],
  ['scaleY', 'targetScaleY', 'vy'],
  ['offsetX', 'targetOffsetX', 'vOffsetX'],
  ['offsetY', 'targetOffsetY', 'vOffsetY'],
  ['rotation', 'targetRotation', 'vRotation'],
  ['pressure', 'targetPressure', 'vPressure'],
  ['pressX', 'targetPressX', 'vPressX'],
  ['pressY', 'targetPressY', 'vPressY'],
];
/**
 * Wax-ppu ASMR Simulator - Unified Physics & Rendering Engine
 * Supports dual modes:
 * 1. 'wax' - Shattering wax with crack textures and triangle physics shards
 * 2. 'squishy' - Ultra-elastic mochi squishy toy with volume-preserving squash & stretch, dragging tension, and ASMR particles
 */

export class WaxPhysicsEngine {
  constructor(canvas, invalidate = () => {}) {
    this.canvas = canvas;
    this.width = CONFIG.view.width;
    this.height = CONFIG.view.height;
    this.invalidate = invalidate;
    this.reducedMotion = false;
    this.feel = FEELS.original;

    // Mode state
    this.mode = 'wax'; // 'wax' | 'squishy'
    this.squishyCharacter = 'cat_paw'; // 'cat_paw' | 'mochi_rabbit'

    // ==========================================
    // 1. WAX MODE ASSETS & STATE
    // ==========================================
    this.customImages = {};
    this._loadWaxImages();

    this.squishy = {
      x: this.width / 2,
      y: this.height / 2,
      baseRadius: CONFIG.wax.radius,
      scaleX: 1.0,
      scaleY: 1.0,
      vx: 0,
      vy: 0,
      targetScaleX: 1.0,
      targetScaleY: 1.0,
      springK: CONFIG.wax.springK,
      damping: CONFIG.wax.damping,
    };

    this.particles = []; // Shattered falling wax shards
    this.currentWaxImage = 'wax';
    this.gravity = CONFIG.wax.gravity;

    // ==========================================
    // 2. SQUISHY (말랑이) MODE ASSETS & STATE
    // ==========================================
    this.squishyImages = {};
    this.squishyLoading = null;

    this.squishyObj = {
      x: this.width / 2,
      y: this.height / 2,
      baseRadius: CONFIG.mochi.radius, // 300x300 display
      scaleX: 1.0,
      scaleY: 1.0,
      targetScaleX: 1.0,
      targetScaleY: 1.0,
      vx: 0,
      vy: 0,
      springK: CONFIG.mochi.springK,
      damping: CONFIG.mochi.damping,

      // Drag and stretch tension
      offsetX: 0,
      offsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
      vOffsetX: 0,
      vOffsetY: 0,
      stretchSpringK: 0.18,
      stretchDamping: 0.7,

      // Rotation
      rotation: 0,
      targetRotation: 0,
      vRotation: 0,

      isPressed: false,
      pressPoint: null,
      pressX: 0,
      pressY: 0,
      targetPressX: 0,
      targetPressY: 0,
      vPressX: 0,
      vPressY: 0,
      pointerX: 0,
      pointerY: 0,
      pressure: 0,
      targetPressure: 0,
      vPressure: 0,
    };

    this.squishyParticles = []; // Hearts, stars, jelly bubbles
    this.renderer = new SimulationRenderer(this);
  }

  /**
   * Preloads the user's custom wax images
   */
  _loadWaxImages() {
    const files = {
      wax: 'Wax.png',
      ...Object.fromEntries(
        CRACKS.map((key, i) => [key, `Cracked_Wax${i + 1}.png`]),
      ),
    };
    this.assetFailures = [];
    const queue = Object.entries(files);
    const worker = async () => {
      while (queue.length) {
        const [key, file] = queue.shift();
        await loadTexture(`images/${file}`)
          .then((image) => {
            this.customImages[key] = image;
            this.invalidate();
          })
          .catch(() => {
            this.assetFailures.push(key);
            this.invalidate();
          });
      }
    };
    this.waxLoading = Promise.all([worker(), worker()]);
  }

  _loadSquishyImages() {
    if (this.squishyLoading) return this.squishyLoading;
    this.squishyLoading = Promise.all(
      [
        ['cat_paw', '고양이_발바닥'],
        ['mochi_rabbit', '말랑_토끼'],
      ].map(([key, fallback]) =>
        loadTexture(`images/squishy/${key}.png`)
          .catch(() => loadTexture(`images/squishy/${fallback}.png`))
          .then((image) => {
            this.squishyImages[key] = image;
            this.invalidate();
          })
          .catch(() => {
            this.assetFailures.push(key);
            this.invalidate();
          }),
      ),
    );
    return this.squishyLoading;
  }

  setFeel(name) {
    this.feel = FEELS[name] || FEELS.original;
    this.squishyObj.springK = this.feel.springK;
    this.squishyObj.damping = this.feel.damping;
  }

  hitTest(mx, my) {
    const sq = this.mode === 'wax' ? this.squishy : this.squishyObj;
    const dx = mx - sq.x - (sq.offsetX || 0);
    const dy = my - sq.y - (sq.offsetY || 0);
    const a = -(sq.rotation || 0),
      c = Math.cos(a),
      sn = Math.sin(a);
    const x = (dx * c - dy * sn) / Math.max(0.2, sq.scaleX);
    const y = (dx * sn + dy * c) / Math.max(0.2, sq.scaleY);
    const radius = sq.baseRadius * (this.mode === 'wax' ? 1.1 : 1.15);
    return x * x + y * y < radius * radius;
  }

  isActive() {
    const sq = this.mode === 'wax' ? this.squishy : this.squishyObj;
    if (this.particles.length || this.squishyParticles.length) return true;
    for (const [position, target, velocity] of SETTLE_AXES) {
      if (!(position in sq)) continue;
      if (
        Math.abs(sq[position] - sq[target]) > 0.001 ||
        Math.abs(sq[velocity]) > 0.001
      )
        return true;
      sq[position] = sq[target];
      sq[velocity] = 0;
    }
    return false;
  }

  setMode(newMode) {
    if (!['wax', 'squishy'].includes(newMode) || this.mode === newMode) return;
    this.handleSquishyUp();
    this.particles.length = 0;
    this.squishyParticles.length = 0;
    this.mode = newMode;
    if (newMode === 'squishy') {
      this._loadSquishyImages();
      this.resetSquishy();
    } else {
      this.reset();
    }
  }

  /**
   * Switch active squishy character ('cat_paw' | 'mochi_rabbit')
   */
  setSquishyCharacter(character) {
    if (
      !['cat_paw', 'mochi_rabbit'].includes(character) ||
      this.squishyCharacter === character
    )
      return;
    this.squishyCharacter = character;
    this.resetSquishy();
    // Give a little welcoming bounce
    this.squishyObj.scaleY = 0.8;
    this.squishyObj.scaleX = 1.15;
  }

  /**
   * Resets squishy state
   */
  resetSquishy() {
    const sq = this.squishyObj;
    sq.scaleX = 1.0;
    sq.scaleY = 1.0;
    sq.targetScaleX = 1.0;
    sq.targetScaleY = 1.0;
    sq.vx = 0;
    sq.vy = 0;
    sq.offsetX = 0;
    sq.offsetY = 0;
    sq.targetOffsetX = 0;
    sq.targetOffsetY = 0;
    sq.vOffsetX = 0;
    sq.vOffsetY = 0;
    sq.rotation = 0;
    sq.targetRotation = 0;
    sq.vRotation = 0;
    sq.isPressed = false;
    sq.pressPoint = null;
    sq.pressure = sq.targetPressure = sq.vPressure = 0;
    sq.pressX = sq.pressY = sq.targetPressX = sq.targetPressY = 0;
    sq.vPressX = sq.vPressY = sq.pointerX = sq.pointerY = 0;
    this.squishyParticles.length = 0;
  }

  /**
   * Resets the wax shell back to whole
   */
  reset(gravityVal = CONFIG.wax.gravity) {
    this.currentWaxImage = 'wax';
    this.squishy.scaleX = 1.0;
    this.squishy.scaleY = 1.0;
    this.squishy.y = this.height / 2;
    this.squishy.vx = 0;
    this.squishy.vy = 0;
    this.particles.length = 0;
    this.gravity = gravityVal;
  }

  // ==========================================
  // INTERACTION HANDLERS (WAX vs SQUISHY)
  // ==========================================

  /**
   * Handles clicking on the wax object (Wax Mode)
   */
  handleClick(mx, my) {
    if (this.mode === 'squishy') {
      return this.handleSquishyDown(mx, my);
    }

    const dx = mx - this.squishy.x;
    const dy = my - this.squishy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.hitTest(mx, my)) {
      const crackedStates = CRACKS;
      const randomIndex = Math.floor(Math.random() * crackedStates.length);
      this.currentWaxImage = crackedStates[randomIndex];

      const angle = Math.atan2(dy, dx);
      this.squishy.scaleX = 1.0 + Math.cos(angle) * 0.15;
      this.squishy.scaleY = 1.0 - Math.abs(Math.sin(angle)) * 0.15;

      this.spawnShards(mx, my, 8 + Math.floor(Math.random() * 6));
      return 'shatter';
    }

    return 'none';
  }

  /**
   * Handles press down on squishy (Squishy Mode)
   */
  handleSquishyDown(mx, my) {
    const sq = this.squishyObj;
    // Check if inside squishy radius
    if (this.hitTest(mx, my)) {
      sq.isPressed = true;
      sq.pressPoint = { x: mx, y: my };
      sq.pointerX = mx;
      sq.pointerY = my;
      this._updateContactTarget();
      sq.pressX = sq.targetPressX;
      sq.pressY = sq.targetPressY;
      sq.vPressX = sq.vPressY = 0;
      // Repeated taps begin at the new contact instead of piling up impulses.
      sq.pressure = 0.18;
      sq.vPressure = 0;
      sq.targetPressure = this.feel.squeeze;
      sq.targetScaleX = 1.025;
      sq.targetScaleY = 0.975;
      sq.targetRotation = 0;

      // Spawn cute jelly particles
      this.spawnSquishyParticles(mx, my, 5 + Math.floor(Math.random() * 4));

      return 'squish'; // Triggers press sound
    }

    return 'none';
  }

  _updateContactTarget() {
    const sq = this.squishyObj;
    const dx = sq.pointerX - sq.x - sq.offsetX;
    const dy = sq.pointerY - sq.y - sq.offsetY;
    const c = Math.cos(sq.rotation),
      s = Math.sin(sq.rotation);
    const x = (dx * c + dy * s) / Math.max(0.2, sq.scaleX);
    const y = (-dx * s + dy * c) / Math.max(0.2, sq.scaleY);
    // Outside the toy, keep the contact on its soft edge rather than detaching it.
    const factor = Math.min(1, sq.baseRadius / Math.max(1, Math.hypot(x, y)));
    sq.targetPressX = x * factor;
    sq.targetPressY = y * factor;
  }

  /**
   * Handles drag/move on squishy (Squishy Mode)
   */
  handleSquishyMove(mx, my) {
    if (
      this.mode !== 'squishy' ||
      !this.squishyObj.isPressed ||
      !this.squishyObj.pressPoint
    ) {
      return 'none';
    }

    const sq = this.squishyObj;
    if (Math.hypot(mx - sq.pointerX, my - sq.pointerY) < 0.5) return 'none';
    sq.pointerX = mx;
    sq.pointerY = my;
    const pullDx = mx - sq.pressPoint.x;
    const pullDy = my - sq.pressPoint.y;
    const pullDist = Math.sqrt(pullDx * pullDx + pullDy * pullDy);

    // The body follows slightly; the main deformation slides under the pointer.
    const maxPull = this.feel.pull;
    const clampedDist = Math.min(maxPull, pullDist);
    const pullAngle = Math.atan2(pullDy, pullDx);

    sq.targetOffsetX = Math.cos(pullAngle) * clampedDist * 0.28;
    sq.targetOffsetY = Math.sin(pullAngle) * clampedDist * 0.28;

    // Stretch towards pull direction
    const stretchAmount = (clampedDist / maxPull) * 0.045;
    const pCos2 = Math.cos(pullAngle) * Math.cos(pullAngle);
    const pSin2 = Math.sin(pullAngle) * Math.sin(pullAngle);

    sq.targetScaleX =
      1.025 + pCos2 * stretchAmount - pSin2 * (stretchAmount * 0.5);
    sq.targetScaleY =
      0.975 + pSin2 * stretchAmount - pCos2 * (stretchAmount * 0.5);
    sq.targetRotation = (sq.targetOffsetX / maxPull) * 0.08;
    this._updateContactTarget();
    return 'squish';
  }

  /**
   * Handles release/up on squishy (Squishy Mode)
   * Triggers elastic spring bounce-back
   */
  handleSquishyUp() {
    if (this.mode !== 'squishy' || !this.squishyObj.isPressed) return;

    const sq = this.squishyObj;
    sq.isPressed = false;
    sq.pressPoint = null;
    sq.targetPressure = 0;
    // Fade the final contact in place while the body restores.
    sq.targetPressX = sq.pressX;
    sq.targetPressY = sq.pressY;
    sq.vPressX = sq.vPressY = 0;

    // Return targets to normal
    sq.targetScaleX = 1.0;
    sq.targetScaleY = 1.0;
    sq.targetOffsetX = 0;
    sq.targetOffsetY = 0;
    sq.targetRotation = 0;

    // Elastic rebound snap impulse!
    sq.vOffsetX += -sq.offsetX * 0.45;
    sq.vOffsetY += -sq.offsetY * 0.45;
    sq.vx += (1.0 - sq.scaleX) * 0.6;
    sq.vy += (1.0 - sq.scaleY) * 0.6;
  }

  /**
   * Spawns squishy ASMR particles (Hearts, Stars, Jelly bubbles)
   */
  spawnSquishyParticles(mx, my, count) {
    const isCat = this.squishyCharacter === 'cat_paw';
    const symbols = isCat ? ['♥', '✦', '●', '🌸'] : ['✦', '♥', '●', '☁'];
    const colors = isCat
      ? ['#ff5d9e', '#ff85b3', '#ffaec9', '#ffffff']
      : ['#ffb3c6', '#ffffff', '#e0c3fc', '#fde2e4'];

    count = this.reducedMotion
      ? 0
      : Math.min(
          count,
          CONFIG.mochi.maxParticles - this.squishyParticles.length,
        );
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.5;

      this.squishyParticles.push({
        x: mx + (Math.random() - 0.5) * 20,
        y: my + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.0, // float upwards
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 14 + Math.random() * 12,
        rotation: Math.random() * Math.PI * 2,
        vRotation: (Math.random() - 0.5) * 0.15,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.02,
      });
    }
  }

  /**
   * Generates triangular shards for wax mode
   */
  spawnShards(mx, my, count) {
    count = this.reducedMotion ? Math.min(3, count) : count;
    count = Math.min(count, CONFIG.wax.maxParticles - this.particles.length);
    const texture =
      this.customImages[this.currentWaxImage] || this.customImages.wax || null;
    for (let i = 0; i < count; i++) {
      const v0 = {
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 20,
      };
      const v1 = {
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 20,
      };
      const v2 = {
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 20,
      };

      const cx = (v0.x + v1.x + v2.x) / 3;
      const cy = (v0.y + v1.y + v2.y) / 3;

      const vertices = [
        { x: v0.x - cx, y: v0.y - cy },
        { x: v1.x - cx, y: v1.y - cy },
        { x: v2.x - cx, y: v2.y - cy },
      ];

      const px = mx + (Math.random() - 0.5) * 15;
      const py = my + (Math.random() - 0.5) * 15;

      const localX = px - this.squishy.x;
      const localY = py - this.squishy.y;

      const angle = Math.atan2(py - this.squishy.y, px - this.squishy.x);
      const force = 3.0 + Math.random() * 5.0;
      const vx = Math.cos(angle) * force + (Math.random() - 0.5) * 2;
      const vy = Math.sin(angle) * force - 3.0 - Math.random() * 3.0;

      this.particles.push({
        x: px,
        y: py,
        vx: vx,
        vy: vy,
        angle: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        vertices: vertices,
        texture,
        localCentroid: { x: localX, y: localY },
        life: 1.0,
        decay: 0.015 + Math.random() * 0.018,
        bounces: 0,
      });
    }
  }

  /**
   * Main update loop
   */
  update(dt) {
    if (this.mode === 'squishy') {
      this._updateSquishy(dt);
      if (this.reducedMotion && !this.squishyObj.isPressed) this.resetSquishy();
    } else {
      this._updateWax(dt);
      if (this.reducedMotion) {
        this.squishy.scaleX = this.squishy.scaleY = 1;
        this.squishy.vx = this.squishy.vy = 0;
      }
    }
  }

  /**
   * Updates wax physics & falling particles
   */
  _updateWax(dt) {
    const sq = this.squishy;
    const ax = sq.springK * (sq.targetScaleX - sq.scaleX);
    const ay = sq.springK * (sq.targetScaleY - sq.scaleY);

    sq.vx += ax;
    sq.vy += ay;
    sq.vx *= sq.damping;
    sq.vy *= sq.damping;

    sq.scaleX += sq.vx * dt;
    sq.scaleY += sq.vy * dt;

    let write = 0;
    for (let read = 0; read < this.particles.length; read++) {
      const p = this.particles[read];
      p.vy += this.gravity * 0.02 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.vr * dt;

      const floorLevel = this.height - 15;
      if (p.y > floorLevel) {
        p.y = floorLevel;
        p.vy = -p.vy * 0.35;
        p.vx *= 0.6;
        p.vr *= 0.5;
        p.bounces++;

        if (p.bounces > 2) {
          p.vx = 0;
          p.vy = 0;
          p.vr = 0;
        }
      }

      p.life -= p.decay * dt;
      if (p.life > 0) {
        this.particles[write++] = p;
      }
    }
    this.particles.length = write;
  }

  /**
   * Updates squishy spring elasticity & jelly particles
   */
  _updateSquishy(dt) {
    const sq = this.squishyObj;
    sq.vPressure += sq.springK * (sq.targetPressure - sq.pressure);
    // A soft, nearly critically damped return keeps the displaced rim smooth.
    sq.vPressure *= 0.58;
    sq.pressure = Math.max(0, Math.min(1.3, sq.pressure + sq.vPressure * dt));

    // 1. Scale spring bounce
    const ax = sq.springK * (sq.targetScaleX - sq.scaleX);
    const ay = sq.springK * (sq.targetScaleY - sq.scaleY);
    sq.vx += ax;
    sq.vy += ay;
    sq.vx *= sq.damping;
    sq.vy *= sq.damping;
    sq.scaleX += sq.vx * dt;
    sq.scaleY += sq.vy * dt;

    // 2. Drag stretch offset spring
    const aOffsetX = sq.stretchSpringK * (sq.targetOffsetX - sq.offsetX);
    const aOffsetY = sq.stretchSpringK * (sq.targetOffsetY - sq.offsetY);
    sq.vOffsetX += aOffsetX;
    sq.vOffsetY += aOffsetY;
    sq.vOffsetX *= sq.stretchDamping;
    sq.vOffsetY *= sq.stretchDamping;
    sq.offsetX += sq.vOffsetX * dt;
    sq.offsetY += sq.vOffsetY * dt;

    // 3. Rotation spring
    const aRot = 0.15 * (sq.targetRotation - sq.rotation);
    sq.vRotation += aRot;
    sq.vRotation *= 0.76;
    sq.rotation += sq.vRotation * dt;

    // Keep contact in material space as the following body moves and rotates.
    if (sq.isPressed) {
      this._updateContactTarget();
      sq.vPressX = (sq.targetPressX - sq.pressX) * 0.36;
      sq.vPressY = (sq.targetPressY - sq.pressY) * 0.36;
      sq.pressX += sq.vPressX * dt;
      sq.pressY += sq.vPressY * dt;
    }

    // 4. Update floating squishy particles
    let write = 0;
    for (let read = 0; read < this.squishyParticles.length; read++) {
      const p = this.squishyParticles[read];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.05 * dt; // gentle gravity
      p.rotation += p.vRotation * dt;
      p.life -= p.decay * dt;

      if (p.life > 0) {
        this.squishyParticles[write++] = p;
      }
    }
    this.squishyParticles.length = write;
  }

  /**
   * Main draw loop
   */
  draw(ctx) {
    this.renderer.draw(ctx);
  }
}
