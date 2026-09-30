import { CONFIG } from '../config.js';
import { assetUrl, loadSoundBank } from '../core/assets.js';

export class WaxAudioEngine {
  constructor(onState = (_state) => {}) {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.noise = null;
    this.volume = CONFIG.audio.volume;
    this.preset = 'original';
    this.voices = new Set();
    this.banks = { wax: [], squishy: [] };
    this.loading = {};
    this.onState = onState;
    this.resumePromise = null;
  }
  // Called synchronously from the user's click/touch, never from an asset callback.
  unlock() {
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) throw new Error('Web Audio 미지원');
        this.ctx = new Context({ latencyHint: 'interactive' });
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -8;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 6;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.15;
        this.master.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
        this.noise = this.ctx.createBuffer(
          1,
          this.ctx.sampleRate,
          this.ctx.sampleRate,
        );
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'running') return Promise.resolve(true);
      if (!this.resumePromise) {
        this.resumePromise = this.ctx
          .resume()
          .then(() => {
            const ready = this.ctx.state === 'running';
            this.onState(ready ? 'ready' : 'muted');
            return ready;
          })
          .catch(() => {
            this.onState('muted');
            return false;
          })
          .finally(() => {
            this.resumePromise = null;
          });
      }
      return this.resumePromise;
    } catch {
      this.onState('muted');
      return Promise.resolve(false);
    }
  }
  warm(mode) {
    if (!this.ctx || this.loading[mode]) return this.loading[mode];
    const urls =
      mode === 'wax'
        ? Array.from({ length: 9 }, (_, i) =>
            assetUrl(`sounds/Cracked_Sound${i + 1}.m4a`),
          )
        : Array.from({ length: 7 }, (_, i) =>
            assetUrl(`sounds/squishy/squish_${i + 1}.m4a`),
          );
    this.loading[mode] = loadSoundBank(this.ctx, urls, (buffer) =>
      this.banks[mode].push(buffer),
    );
    return this.loading[mode];
  }
  setVolume(value) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    if (this.ctx && this.master)
      this.master.gain.setTargetAtTime(
        this.volume,
        this.ctx.currentTime,
        0.015,
      );
  }
  setPreset(value) {
    if (['original', 'crispy', 'thick', 'soft'].includes(value))
      this.preset = value;
  }
  _start(source, nodes, when, duration, offset = 0) {
    if (this.voices.size >= CONFIG.audio.maxVoices) {
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
      return;
    }
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
    };
    try {
      if ('buffer' in source) source.start(when, offset);
      else source.start(when);
      if (duration !== null) source.stop(when + duration);
    } catch {
      this.voices.delete(source);
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
    }
  }
  _sample(mode, intensity) {
    const bank = this.banks[mode];
    if (!bank.length) return false;
    const ctx = this.ctx,
      now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = bank[Math.floor(Math.random() * bank.length)];
    const pitch =
      this.preset === 'thick'
        ? 0.86
        : this.preset === 'crispy'
          ? 1.09
          : this.preset === 'soft'
            ? 0.95
            : 1;
    source.playbackRate.value =
      pitch * (CONFIG.audio.pitchMin + Math.random() * CONFIG.audio.pitchSpan);
    const gain = ctx.createGain();
    gain.gain.value =
      Math.min(1.2, intensity) * (this.preset === 'soft' ? 0.7 : 1);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value =
      this.preset === 'soft' ? 3000 : Math.min(18000, ctx.sampleRate / 2);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    this._start(source, [filter, gain], now, null);
    return true;
  }
  _noiseBurst(now, duration, frequency, intensity, type = 'bandpass') {
    const ctx = this.ctx,
      source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = type === 'bandpass' ? 6 : 0.7;
    filter.frequency.setValueAtTime(frequency, now);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(60, frequency * 0.4),
      now + duration,
    );
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(Math.max(0.001, intensity), now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    this._start(
      source,
      [filter, gain],
      now,
      duration + 0.04,
      Math.random() * 0.3,
    );
  }
  _body(now, duration, frequency, intensity) {
    const ctx = this.ctx,
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency * 1.6, now);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.5, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(intensity, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    this._start(osc, [gain], now, duration + 0.04);
  }
  play(mode, intensity = 1) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.volume) return;
    if (!Number.isFinite(intensity)) return;
    intensity = Math.max(0.1, Math.min(1.2, intensity));
    if (this._sample(mode, intensity)) return;
    const now = this.ctx.currentTime;
    if (mode === 'wax') {
      const low = this.preset === 'thick' || this.preset === 'soft';
      for (let i = 0; i < 5; i++)
        this._noiseBurst(
          now + i * (0.005 + Math.random() * 0.015),
          low ? 0.07 : 0.04,
          low ? 1100 : 2800,
          0.4 * intensity,
        );
      if (low) this._body(now, 0.13, 80, 0.2 * intensity);
    } else {
      this._noiseBurst(now, 0.24, 500, 0.22 * intensity, 'lowpass');
      this._body(now, 0.22, 85, 0.18 * intensity);
    }
  }
  stopVoices() {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* already ended */
      }
    }
  }
  suspend() {
    this.stopVoices();
    if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => {});
  }
  async dispose() {
    this.stopVoices();
    if (this.ctx && this.ctx.state !== 'closed')
      await this.ctx.close().catch(() => {});
  }
}
