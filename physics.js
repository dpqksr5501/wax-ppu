/**
 * Wax-ppu ASMR Simulator - Unified Physics & Rendering Engine
 * Supports dual modes:
 * 1. 'wax' - Shattering wax with crack textures and triangle physics shards
 * 2. 'squishy' - Ultra-elastic mochi squishy toy with volume-preserving squash & stretch, dragging tension, and ASMR particles
 */

class WaxPhysicsEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Mode state
        this.mode = 'wax'; // 'wax' | 'squishy'
        this.squishyCharacter = 'cat_paw'; // 'cat_paw' | 'mochi_rabbit'

        // ==========================================
        // 1. WAX MODE ASSETS & STATE
        // ==========================================
        this.customImages = {};
        this.imagesLoaded = false;
        this._loadWaxImages();

        this.squishy = {
            x: this.width / 2,
            y: this.height / 2,
            baseRadius: 130,
            scaleX: 1.0,
            scaleY: 1.0,
            vx: 0,
            vy: 0,
            targetScaleX: 1.0,
            targetScaleY: 1.0,
            springK: 0.15,
            damping: 0.82
        };

        this.particles = []; // Shattered falling wax shards
        this.currentWaxImage = 'wax';
        this.gravity = 14;

        // ==========================================
        // 2. SQUISHY (말랑이) MODE ASSETS & STATE
        // ==========================================
        this.squishyImages = {};
        this.squishyImagesLoaded = false;
        this._loadSquishyImages();

        this.squishyObj = {
            x: this.width / 2,
            y: this.height / 2,
            baseRadius: 150, // 300x300 display
            scaleX: 1.0,
            scaleY: 1.0,
            targetScaleX: 1.0,
            targetScaleY: 1.0,
            vx: 0,
            vy: 0,
            springK: 0.22,
            damping: 0.74,
            
            // Drag and stretch tension
            offsetX: 0,
            offsetY: 0,
            targetOffsetX: 0,
            targetOffsetY: 0,
            vOffsetX: 0,
            vOffsetY: 0,
            stretchSpringK: 0.18,
            stretchDamping: 0.70,

            // Rotation
            rotation: 0,
            targetRotation: 0,
            vRotation: 0,

            isPressed: false,
            pressPoint: null
        };

        this.squishyParticles = []; // Hearts, stars, jelly bubbles
    }

    /**
     * Preloads the user's custom wax images
     */
    _loadWaxImages() {
        const imageFiles = {
            'wax': 'assets/images/Wax.png',
            'cracked1': 'assets/images/Cracked_Wax1.png',
            'cracked2': 'assets/images/Cracked_Wax2.png',
            'cracked3': 'assets/images/Cracked_Wax3.png',
            'cracked4': 'assets/images/Cracked_Wax4.png',
            'cracked5': 'assets/images/Cracked_Wax5.png',
            'cracked6': 'assets/images/Cracked_Wax6.png',
            'cracked7': 'assets/images/Cracked_Wax7.png',
            'cracked8': 'assets/images/Cracked_Wax8.png'
        };

        let loadedCount = 0;
        const totalCount = Object.keys(imageFiles).length;

        for (const [key, src] of Object.entries(imageFiles)) {
            const img = new Image();
            img.onload = () => {
                this.customImages[key] = img;
                loadedCount++;
                if (loadedCount === totalCount) {
                    this.imagesLoaded = true;
                    console.log("All custom wax images preloaded successfully.");
                }
            };
            img.onerror = () => {
                console.warn(`Could not load wax image: ${src}`);
            };
            img.src = src;
        }
    }

    /**
     * Preloads squishy (말랑이) images
     */
    _loadSquishyImages() {
        const squishyFiles = {
            'cat_paw': 'assets/images/squishy/cat_paw.png',
            'mochi_rabbit': 'assets/images/squishy/mochi_rabbit.png'
        };

        let loadedCount = 0;
        const totalCount = Object.keys(squishyFiles).length;

        for (const [key, src] of Object.entries(squishyFiles)) {
            const img = new Image();
            img.onload = () => {
                this.squishyImages[key] = img;
                loadedCount++;
                if (loadedCount === totalCount) {
                    this.squishyImagesLoaded = true;
                    console.log("All squishy images preloaded successfully.");
                }
            };
            img.onerror = () => {
                // Fallback to Korean named files if needed
                const fallbackSrc = key === 'cat_paw' ? 'assets/images/squishy/고양이_발바닥.png' : 'assets/images/squishy/말랑_토끼.png';
                const fbImg = new Image();
                fbImg.onload = () => {
                    this.squishyImages[key] = fbImg;
                };
                fbImg.src = fallbackSrc;
            };
            img.src = src;
        }
    }

    /**
     * Switch simulator mode ('wax' | 'squishy')
     */
    setMode(newMode) {
        if (this.mode === newMode) return;
        this.mode = newMode;
        if (newMode === 'squishy') {
            this.resetSquishy();
        } else {
            this.reset();
        }
    }

    /**
     * Switch active squishy character ('cat_paw' | 'mochi_rabbit')
     */
    setSquishyCharacter(character) {
        if (this.squishyCharacter === character) return;
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
        this.squishyParticles = [];
    }

    /**
     * Resets the wax shell back to whole
     */
    reset(gravityVal = 14) {
        this.currentWaxImage = 'wax';
        this.squishy.scaleX = 1.0;
        this.squishy.scaleY = 1.0;
        this.squishy.y = this.height / 2;
        this.squishy.vx = 0;
        this.squishy.vy = 0;
        this.particles = [];
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

        if (dist < this.squishy.baseRadius * 1.1) {
            const crackedStates = [
                'cracked1', 'cracked2', 'cracked3', 'cracked4',
                'cracked5', 'cracked6', 'cracked7', 'cracked8'
            ];
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
        const currentCenterX = sq.x + sq.offsetX;
        const currentCenterY = sq.y + sq.offsetY;

        const dx = mx - currentCenterX;
        const dy = my - currentCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check if inside squishy radius
        if (dist < sq.baseRadius * 1.15) {
            sq.isPressed = true;
            sq.pressPoint = { x: mx, y: my };

            const angle = Math.atan2(dy, dx);
            const pressForce = Math.min(1.0, 0.4 + (dist / sq.baseRadius) * 0.6);

            // Volume-preserving squash & stretch:
            // Squeezed along press axis, bulges out in perpendicular axis
            const cos2 = Math.cos(angle) * Math.cos(angle);
            const sin2 = Math.sin(angle) * Math.sin(angle);

            sq.targetScaleX = 1.0 - cos2 * (0.28 * pressForce) + sin2 * (0.24 * pressForce);
            sq.targetScaleY = 1.0 - sin2 * (0.28 * pressForce) + cos2 * (0.24 * pressForce);
            sq.targetRotation = (dx / sq.baseRadius) * 0.12;

            // Spawn cute jelly particles
            this.spawnSquishyParticles(mx, my, 5 + Math.floor(Math.random() * 4));

            return 'squish'; // Triggers press sound
        }

        return 'none';
    }

    /**
     * Handles drag/move on squishy (Squishy Mode)
     */
    handleSquishyMove(mx, my) {
        if (this.mode !== 'squishy' || !this.squishyObj.isPressed || !this.squishyObj.pressPoint) {
            return;
        }

        const sq = this.squishyObj;
        const pullDx = mx - sq.pressPoint.x;
        const pullDy = my - sq.pressPoint.y;
        const pullDist = Math.sqrt(pullDx * pullDx + pullDy * pullDy);

        // Limit maximum stretching distance (max 65px)
        const maxPull = 65;
        const clampedDist = Math.min(maxPull, pullDist);
        const pullAngle = Math.atan2(pullDy, pullDx);

        sq.targetOffsetX = Math.cos(pullAngle) * clampedDist * 0.65;
        sq.targetOffsetY = Math.sin(pullAngle) * clampedDist * 0.65;

        // Stretch towards pull direction
        const stretchAmount = (clampedDist / maxPull) * 0.25;
        const pCos2 = Math.cos(pullAngle) * Math.cos(pullAngle);
        const pSin2 = Math.sin(pullAngle) * Math.sin(pullAngle);

        sq.targetScaleX = 1.0 + pCos2 * stretchAmount - pSin2 * (stretchAmount * 0.5);
        sq.targetScaleY = 1.0 + pSin2 * stretchAmount - pCos2 * (stretchAmount * 0.5);
        sq.targetRotation = (sq.targetOffsetX / maxPull) * 0.18;
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
                decay: 0.02 + Math.random() * 0.02
            });
        }
    }

    /**
     * Generates triangular shards for wax mode
     */
    spawnShards(mx, my, count) {
        for (let i = 0; i < count; i++) {
            const v0 = { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 };
            const v1 = { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 };
            const v2 = { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 };
            
            const cx = (v0.x + v1.x + v2.x) / 3;
            const cy = (v0.y + v1.y + v2.y) / 3;
            
            const vertices = [
                { x: v0.x - cx, y: v0.y - cy },
                { x: v1.x - cx, y: v1.y - cy },
                { x: v2.x - cx, y: v2.y - cy }
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
                localCentroid: { x: localX, y: localY },
                life: 1.0,
                decay: 0.015 + Math.random() * 0.018,
                bounces: 0
            });
        }
    }

    /**
     * Main update loop
     */
    update(dt) {
        if (this.mode === 'squishy') {
            this._updateSquishy(dt);
        } else {
            this._updateWax(dt);
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

        const activeParticles = [];
        this.particles.forEach(p => {
            p.vy += (this.gravity * 0.02) * dt;
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
                activeParticles.push(p);
            }
        });
        this.particles = activeParticles;
    }

    /**
     * Updates squishy spring elasticity & jelly particles
     */
    _updateSquishy(dt) {
        const sq = this.squishyObj;

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

        // 4. Update floating squishy particles
        const activeParticles = [];
        this.squishyParticles.forEach(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 0.05 * dt; // gentle gravity
            p.rotation += p.vRotation * dt;
            p.life -= p.decay * dt;

            if (p.life > 0) {
                activeParticles.push(p);
            }
        });
        this.squishyParticles = activeParticles;
    }

    /**
     * Main draw loop
     */
    draw(ctx) {
        ctx.clearRect(0, 0, this.width, this.height);

        if (this.mode === 'squishy') {
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
        const sq = this.squishy;
        ctx.save();
        ctx.translate(sq.x, sq.y);
        ctx.scale(sq.scaleX, sq.scaleY);

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        const size = sq.baseRadius * 2;
        const activeImage = this.customImages[this.currentWaxImage];

        if (this.imagesLoaded && activeImage) {
            ctx.drawImage(activeImage, -size / 2, -size / 2, size, size);
        } else {
            const grad = ctx.createRadialGradient(-15, -25, sq.baseRadius * 0.1, 0, 0, sq.baseRadius);
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
            ctx.fillText('왁스 로딩 대기...', 0, -10);
            ctx.font = '11px sans-serif';
            ctx.fillText('(assets/images/)', 0, 15);
        }

        ctx.restore();
    }

    /**
     * Draws squishy mochi toy with soft silicone drop-shadow & particles
     */
    _drawSquishy(ctx) {
        const sq = this.squishyObj;
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
        
        const shadowGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, sq.baseRadius * 0.95);
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.18)');
        shadowGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.08)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, sq.baseRadius * 0.95, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. Draw Squishy Character with Elastic Transformation
        ctx.save();
        ctx.translate(currentCenterX, currentCenterY);
        ctx.rotate(sq.rotation);
        ctx.scale(sq.scaleX, sq.scaleY);

        const activeImg = this.squishyImages[this.squishyCharacter];

        if (this.squishyImagesLoaded && activeImg) {
            ctx.drawImage(activeImg, -size / 2, -size / 2, size, size);
        } else {
            // Fallback cute placeholder
            ctx.fillStyle = this.squishyCharacter === 'cat_paw' ? '#ffccd5' : '#f8f9fa';
            ctx.beginPath();
            ctx.arc(0, 0, sq.baseRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff4d6d';
            ctx.font = 'bold 20px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.squishyCharacter === 'cat_paw' ? '🐾 고양이 발바닥' : '🐰 말랑 토끼', 0, 0);
        }

        ctx.restore();

        // 3. Draw ASMR Floating Particles
        this._drawSquishyParticles(ctx);
    }

    /**
     * Draws cute hearts, stars and bubbles floating from squishy
     */
    _drawSquishyParticles(ctx) {
        this.squishyParticles.forEach(p => {
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
        this.particles.forEach(p => {
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

            const activeImage = this.customImages[this.currentWaxImage] || this.customImages['wax'];
            const size = this.squishy.baseRadius * 2;

            if (this.imagesLoaded && activeImage) {
                ctx.save();
                ctx.clip();
                ctx.drawImage(
                    activeImage,
                    -p.localCentroid.x - size / 2,
                    -p.localCentroid.y - size / 2,
                    size,
                    size
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
