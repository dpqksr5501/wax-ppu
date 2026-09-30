/**
 * Wax-ppu ASMR Simulator - Unified Controller
 * Supports dual modes:
 * 1. Wax Shattering ASMR (왁스 뿌시기)
 * 2. Mochi Squishy Toy ASMR (모찌 말랑이) with dynamic audio and jelly physics
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Canvas Setup
    const canvas = document.getElementById('simulator-canvas');
    const ctx = canvas.getContext('2d');
    
    // Set fixed high-res backbuffer for sharp rendering
    canvas.width = 520;
    canvas.height = 520;

    // 2. Instantiate Engines
    const audio = new WaxAudioEngine();
    const physics = new WaxPhysicsEngine(canvas);

    // 3. UI Element References
    const startOverlay = document.getElementById('start-overlay');
    const btnStart = document.getElementById('btn-start');
    const hintOverlay = document.getElementById('hint-overlay');
    const hintText = document.getElementById('hint-text');
    const btnReset = document.getElementById('btn-reset');
    const resetBtnText = document.getElementById('reset-btn-text');
    
    const tabWax = document.getElementById('tab-wax');
    const tabSquishy = document.getElementById('tab-squishy');
    const squishyCharGroup = document.getElementById('squishy-char-group');
    const charChips = document.querySelectorAll('.char-chip');

    const volumeSlider = document.getElementById('volume-slider');
    const volumeVal = document.getElementById('volume-val');

    // States
    let isMouseDown = false;
    let dragThreshold = 50; // Delay (ms) for drag shatter interactions in wax mode
    let lastDragTime = 0;
    let interactionStarted = false;

    // Initialize initial static draw frame
    physics.reset();
    physics.draw(ctx);

    // 4. Game Loop
    let lastTime = performance.now();
    function gameLoop(time) {
        const dt = Math.min(2.0, (time - lastTime) / 16.666);
        lastTime = time;

        physics.update(dt);
        physics.draw(ctx);

        requestAnimationFrame(gameLoop);
    }

    // 5. Start Game Trigger
    btnStart.addEventListener('click', () => {
        audio.init();
        audio.setVolume(parseFloat(volumeSlider.value) / 100);

        startOverlay.classList.add('fade-out');
        
        // Initial instant reset
        physics.reset();

        // Start requestAnimationFrame loop
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
        
        interactionStarted = true;
    });

    // 6. Mode Switcher (Wax vs Squishy)
    tabWax.addEventListener('click', () => {
        tabWax.classList.add('active');
        tabSquishy.classList.remove('active');
        squishyCharGroup.style.display = 'none';
        
        physics.setMode('wax');
        hintText.innerHTML = '<i class="fa-solid fa-hand-pointer animate-tap"></i> 클릭하거나 드래그하여 왁스를 깨뜨리세요!';
        resetBtnText.textContent = '왁스 초기화 (Reset)';
        
        // Brief haptic tap
        triggerHaptic(15);
    });

    tabSquishy.addEventListener('click', () => {
        tabSquishy.classList.add('active');
        tabWax.classList.remove('active');
        squishyCharGroup.style.display = 'flex';
        
        physics.setMode('squishy');
        hintText.innerHTML = '<i class="fa-solid fa-hand-pointer animate-tap"></i> 터치하고 주물러서 말랑이를 늘려보세요!';
        resetBtnText.textContent = '말랑이 제자리로 (Reset)';
        
        // Play one cute squish welcome sound
        audio.playSquishSound(1.0);
        triggerHaptic([15, 20]);
    });

    // 7. Squishy Character Selector
    charChips.forEach(chip => {
        chip.addEventListener('click', () => {
            charChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            const character = chip.dataset.char;
            physics.setSquishyCharacter(character);
            audio.playSquishSound(1.1);
            triggerHaptic(20);
        });
    });

    // 8. Interaction Coordinates Mapper
    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function handleStart(e) {
        if (!interactionStarted) return;
        isMouseDown = true;
        
        // Hide hint overlay on first interaction
        if (hintOverlay.style.opacity !== '0') {
            hintOverlay.style.opacity = '0';
            setTimeout(() => hintOverlay.style.display = 'none', 300);
        }

        const point = getCoords(e);
        
        if (physics.mode === 'squishy') {
            const action = physics.handleSquishyDown(point.x, point.y);
            if (action === 'squish') {
                audio.playSquishSound(1.3);
                triggerHaptic([15, 25]);
            }
        } else {
            const action = physics.handleClick(point.x, point.y);
            if (action === 'shatter') {
                audio.playCrack(1.0, 2);
                triggerHaptic(20);
            }
        }
    }

    function handleMove(e) {
        if (!isMouseDown || !interactionStarted) return;
        const point = getCoords(e);

        if (physics.mode === 'squishy') {
            // Smooth real-time stretching without throttle for jelly deformation
            physics.handleSquishyMove(point.x, point.y);
        } else {
            // Throttled shatter dragging for wax mode
            const now = Date.now();
            if (now - lastDragTime > dragThreshold) {
                const action = physics.handleClick(point.x, point.y);
                if (action === 'shatter') {
                    audio.playCrack(1.0, 2);
                    triggerHaptic(15);
                }
                lastDragTime = now;
            }
        }
    }

    function handleEnd() {
        if (!isMouseDown) return;
        isMouseDown = false;

        if (physics.mode === 'squishy') {
            physics.handleSquishyUp();
        }
    }

    function triggerHaptic(pattern) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

    // Attach Desktop Event Listeners
    canvas.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseleave', () => {
        if (physics.mode === 'squishy' && isMouseDown) {
            physics.handleSquishyUp();
            isMouseDown = false;
        }
    });

    // Attach Mobile Touch Event Listeners with Gutter Scrolling
    let shouldPreventTouch = false;

    canvas.addEventListener('touchstart', (e) => {
        if (!interactionStarted) return;
        
        const point = getCoords(e);
        const canvasCenter = canvas.width / 2; // 260
        const dx = point.x - canvasCenter;
        const dy = point.y - canvasCenter;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Active interactive radius depending on mode
        const activeRadius = physics.mode === 'squishy' ? 175 : 150;
        
        if (dist < activeRadius) {
            shouldPreventTouch = true;
            e.preventDefault();
            handleStart(e);
        } else {
            shouldPreventTouch = false;
            // Let the page scroll naturally when touching outer white gutter
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!interactionStarted) return;
        
        if (shouldPreventTouch) {
            e.preventDefault();
            handleMove(e);
        }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        handleEnd();
        shouldPreventTouch = false;
    });

    window.addEventListener('touchcancel', () => {
        handleEnd();
        shouldPreventTouch = false;
    });

    // 9. Controls Panel Event Handlers
    
    // Volume Control
    volumeSlider.addEventListener('input', (e) => {
        const vol = parseInt(e.target.value);
        volumeVal.textContent = `${vol}%`;
        audio.setVolume(vol / 100);
    });

    // Reset Button
    btnReset.addEventListener('click', () => {
        if (physics.mode === 'squishy') {
            physics.resetSquishy();
            audio.playSquishSound(1.0);
        } else {
            physics.reset();
        }
        triggerHaptic(20);
    });
});
