/**
 * Wax-ppu ASMR Audio Engine
 * Dynamic sound synthesis using Web Audio API (no external asset dependencies).
 */

class WaxAudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.noiseBuffer = null;
        this.volume = 0.8;
        this.preset = 'crispy';
        this.initialized = false;
        
        // Cache for loaded custom sound buffers
        this.customCrackBuffers = [];
        this.customSquishBuffers = [];
    }

    /**
     * Initialize the Web Audio Context and build components.
     * Must be called inside a user interaction callback.
     */
    init() {
        if (this.initialized) return;

        try {
            // Support both standard and legacy AudioContext
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
            
            // Create master volume node
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);
            
            // Generate white noise buffer
            this._createNoiseBuffer();
            
            // Pre-load custom user sound files (Wax & Squishy)
            this._loadCustomSounds();
            this._loadSquishSounds();
            
            this.initialized = true;
            console.log("WaxAudioEngine successfully initialized.");
        } catch (error) {
            console.error("Failed to initialize Web Audio API:", error);
        }
    }

    /**
     * Pre-loads the user's custom crack sounds (Cracked_Sound1.m4a - Cracked_Sound9.m4a)
     */
    async _loadCustomSounds() {
        const soundCount = 9;
        for (let i = 1; i <= soundCount; i++) {
            const url = `assets/sounds/Cracked_Sound${i}.m4a`;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                // Decode the audio data asynchronously
                this.ctx.decodeAudioData(arrayBuffer, 
                    (buffer) => {
                        this.customCrackBuffers.push(buffer);
                        console.log(`Loaded custom sound: ${url}`);
                    },
                    (err) => {
                        console.warn(`Failed to decode audio: ${url}`, err);
                    }
                );
            } catch (error) {
                console.warn(`Could not load custom sound file ${url}. Falling back to dynamic synthesis.`, error);
            }
        }
    }

    /**
     * Pre-loads custom squishy sounds (squish_1.m4a - squish_7.m4a)
     */
    async _loadSquishSounds() {
        const soundCount = 7;
        for (let i = 1; i <= soundCount; i++) {
            const url = `assets/sounds/squishy/squish_${i}.m4a`;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                this.ctx.decodeAudioData(arrayBuffer, 
                    (buffer) => {
                        this.customSquishBuffers.push(buffer);
                        console.log(`Loaded custom squish sound: ${url}`);
                    },
                    (err) => {
                        console.warn(`Failed to decode squish audio: ${url}`, err);
                    }
                );
            } catch (error) {
                console.warn(`Could not load custom squish sound file ${url}.`, error);
            }
        }
    }

    /**
     * Plays a random squishy press ASMR sound with slight pitch variation
     * @param {number} intensity - 0.5 to 1.5
     */
    playSquishSound(intensity = 1.0) {
        if (!this.initialized || !this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;

        if (this.customSquishBuffers.length > 0) {
            try {
                const randomIndex = Math.floor(Math.random() * this.customSquishBuffers.length);
                const buffer = this.customSquishBuffers[randomIndex];

                const source = this.ctx.createBufferSource();
                source.buffer = buffer;

                // Subtle organic pitch variation (0.96 ~ 1.04) so it feels alive and never repetitive
                const pitchVariance = 0.96 + Math.random() * 0.08;
                source.playbackRate.value = pitchVariance;

                const gainNode = this.ctx.createGain();
                // Generous gain boost so ASMR details are crisp and audible
                gainNode.gain.setValueAtTime(intensity * 1.6, now);

                source.connect(gainNode);
                gainNode.connect(this.masterGain);

                source.start(now);
                return;
            } catch (err) {
                console.error("Error playing custom squish sound, falling back to synthesis", err);
            }
        }

        // Fallback to synthetic squish sound if assets not loaded yet
        this.playSquish(intensity);
    }

    /**
     * Generates a 1-second white noise buffer used for filtering
     */
    _createNoiseBuffer() {
        const sampleRate = this.ctx.sampleRate;
        const bufferSize = sampleRate * 1.0; // 1 second
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }

    /**
     * Sets the master volume
     * @param {number} value - Volume between 0.0 and 1.0
     */
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        }
    }

    /**
     * Sets the current sound preset
     * @param {string} presetName - 'crispy' | 'thick' | 'glass'
     */
    setPreset(presetName) {
        if (['crispy', 'thick', 'glass'].includes(presetName)) {
            this.preset = presetName;
        }
    }

    /**
     * Synthesizes a wax cracking sound effect
     * @param {number} intensity - 0.1 to 1.0 (how big the crack is)
     * @param {number} thickness - 1 (thin), 2 (normal), 3 (thick)
     */
    playCrack(intensity = 0.5, thickness = 2) {
        if (!this.initialized || !this.ctx) return;

        // Resume context if suspended
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;

        // Check if custom user sounds are loaded
        if (this.customCrackBuffers.length > 0) {
            try {
                const randomIndex = Math.floor(Math.random() * this.customCrackBuffers.length);
                const buffer = this.customCrackBuffers[randomIndex];
                
                const source = this.ctx.createBufferSource();
                source.buffer = buffer;
                
                // Adjust speed based on thickness (thinner = faster/higher pitch, thicker = slower/deeper)
                let speed = 1.0;
                if (thickness === 1) speed = 1.18;
                if (thickness === 3) speed = 0.82;
                source.playbackRate.value = speed * (0.96 + Math.random() * 0.08); // add subtle variation
                
                const gainNode = this.ctx.createGain();
                gainNode.gain.setValueAtTime(intensity * 1.15, now);
                
                source.connect(gainNode);
                gainNode.connect(this.masterGain);
                
                source.start(now);
                return; // Custom sound played, skip procedural synthesis
            } catch (err) {
                console.error("Error playing custom crack sound, falling back to synthesis", err);
            }
        }
        
        // Base configurations based on preset
        let basePitch = 2000;
        let bandpassQ = 6;
        let crackleCount = 4;
        let soundDuration = 0.05;
        let lowThumpFrequency = 100;
        let playThump = false;

        switch (this.preset) {
            case 'thick':
                basePitch = 800;
                bandpassQ = 4;
                crackleCount = 5;
                soundDuration = 0.12;
                lowThumpFrequency = 70;
                playThump = true;
                break;
            case 'glass':
                basePitch = 4500;
                bandpassQ = 20; // very resonant, ringing tone
                crackleCount = 3;
                soundDuration = 0.06;
                lowThumpFrequency = 150;
                playThump = true;
                break;
            case 'crispy':
            default:
                basePitch = 2800;
                bandpassQ = 8;
                crackleCount = 6;
                soundDuration = 0.04;
                break;
        }

        // Adjust based on thickness setting (thickness: 1 = thin, 2 = medium, 3 = thick)
        if (thickness === 1) { // Thin
            basePitch *= 1.4;
            soundDuration *= 0.7;
            crackleCount = Math.max(3, crackleCount - 1);
        } else if (thickness === 3) { // Thick
            basePitch *= 0.65;
            soundDuration *= 1.5;
            crackleCount = crackleCount + 2;
            playThump = true;
            lowThumpFrequency *= 0.8;
        }

        // 1. Synthesize a cluster of micro-crackles
        for (let i = 0; i < crackleCount; i++) {
            // Stagger crackles slightly to create texture
            const delay = i * (0.005 + Math.random() * 0.015) * (intensity * 0.8 + 0.2);
            this._playMicroCrackle(now + delay, basePitch, bandpassQ, soundDuration, intensity);
        }

        // 2. Play low-frequency solid impact thump (especially for thick wax)
        if (playThump && intensity > 0.3) {
            this._playThump(now, lowThumpFrequency, soundDuration * 1.5, intensity);
        }
    }

    /**
     * Helper to play a single ultra-short filtered noise crackle
     */
    _playMicroCrackle(time, centerFrequency, Q, duration, intensity) {
        if (!this.noiseBuffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = this.noiseBuffer;

        // Apply slight random pitch variance
        const pitchVariance = 0.8 + Math.random() * 0.4;
        source.playbackRate.value = pitchVariance;

        // Bandpass Filter
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = Q;
        
        // Dynamic frequency sweep downwards
        const startFreq = centerFrequency * (0.9 + Math.random() * 0.3);
        const endFreq = startFreq * 0.6;
        filter.frequency.setValueAtTime(startFreq, time);
        filter.frequency.exponentialRampToValueAtTime(endFreq, time + duration);

        // Amplitude Envelope
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0, time);
        // Instant attack
        gainNode.gain.linearRampToValueAtTime(0.6 * intensity, time + 0.002);
        // Exponential decay
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

        // Connect nodes
        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Start and stop playing
        source.start(time, Math.random() * 0.5); // Random start offset in noise buffer
        source.stop(time + duration + 0.05);
    }

    /**
     * Helper to play a low frequency pop oscillator representing the heavy flex of the wax
     */
    _playThump(time, frequency, duration, intensity) {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sine';
        // Pitch drop effect
        osc.frequency.setValueAtTime(frequency * 1.8, time);
        osc.frequency.exponentialRampToValueAtTime(frequency * 0.5, time + duration);

        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.4 * intensity, time + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gainNode);
        gainNode.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + duration + 0.05);
    }

    /**
     * Synthesizes a soft, squishy squelching sound for when the squishy core is pressed
     * @param {number} force - 0.1 to 1.0 (how hard the squish is)
     */
    playSquish(force = 0.5) {
        if (!this.initialized || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const now = this.ctx.currentTime;
        const duration = 0.15 + force * 0.1;

        // Low-pass filtered noise for friction
        if (this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            noise.playbackRate.value = 0.5 + Math.random() * 0.3; // slower playback for lower-frequency friction

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(500, now);
            filter.frequency.exponentialRampToValueAtTime(80, now + duration);

            // Modulator to create wet/gurgling texture (amplitude modulation at 25Hz)
            const ampMod = this.ctx.createGain();
            ampMod.gain.setValueAtTime(0.4 * force, now);

            // Modulator LFO
            const oscMod = this.ctx.createOscillator();
            oscMod.type = 'sine';
            oscMod.frequency.value = 28; // Tremolo frequency
            const modGain = this.ctx.createGain();
            modGain.gain.value = 0.2; // depth of modulation

            // Envelope node
            const envNode = this.ctx.createGain();
            envNode.gain.setValueAtTime(0, now);
            envNode.gain.linearRampToValueAtTime(0.5 * force, now + 0.02);
            envNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

            // Connect AM
            oscMod.connect(modGain);
            modGain.connect(ampMod.gain);
            
            // Connect signal path
            noise.connect(filter);
            filter.connect(ampMod);
            ampMod.connect(envNode);
            envNode.connect(this.masterGain);

            oscMod.start(now);
            noise.start(now, Math.random() * 0.8);
            
            oscMod.stop(now + duration + 0.05);
            noise.stop(now + duration + 0.05);
        }

        // Sub bass body sine wave
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(95, now);
        subOsc.frequency.exponentialRampToValueAtTime(35, now + duration);

        subGain.gain.setValueAtTime(0, now);
        subGain.gain.linearRampToValueAtTime(0.25 * force, now + 0.04);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        subOsc.connect(subGain);
        subGain.connect(this.masterGain);

        subOsc.start(now);
        subOsc.stop(now + duration + 0.05);
    }

    /**
     * Synthesizes a liquid sloshing/dipping sound when the wax is reset.
     */
    playDip() {
        if (!this.initialized || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const now = this.ctx.currentTime;
        const duration = 0.5;

        // Slosh sound: bandpass filtered noise swept up and down
        if (this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            noise.playbackRate.value = 0.7;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.Q.value = 3;
            filter.frequency.setValueAtTime(300, now);
            filter.frequency.exponentialRampToValueAtTime(1000, now + duration * 0.4);
            filter.frequency.exponentialRampToValueAtTime(200, now + duration);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            noise.start(now);
            noise.stop(now + duration + 0.05);
        }

        // A tiny bubble pop in the liquid at the end
        const bubbleTime = now + 0.25;
        const bubbleOsc = this.ctx.createOscillator();
        const bubbleGain = this.ctx.createGain();

        bubbleOsc.type = 'sine';
        bubbleOsc.frequency.setValueAtTime(150, bubbleTime);
        bubbleOsc.frequency.exponentialRampToValueAtTime(700, bubbleTime + 0.06);

        bubbleGain.gain.setValueAtTime(0, bubbleTime);
        bubbleGain.gain.linearRampToValueAtTime(0.15, bubbleTime + 0.002);
        bubbleGain.gain.exponentialRampToValueAtTime(0.001, bubbleTime + 0.06);

        bubbleOsc.connect(bubbleGain);
        bubbleGain.connect(this.masterGain);

        bubbleOsc.start(bubbleTime);
        bubbleOsc.stop(bubbleTime + 0.1);
    }
}
