// Wanderglobe sound system — everything is synthesised live with the Web Audio
// API. No audio files, no downloads: the drones loop perfectly because they're
// just oscillators, and every effect is generated on the fly. Audio only starts
// after the first user gesture (browser autoplay policy), and the mute state is
// remembered in localStorage as `wanderglobe_sound`.

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.reverb = null;
    this.reverbReturn = null;
    this.started = false;
    this.ambient = null; // current drone graph
    this.ambientType = null; // 'earth' | 'solar'
    this.desiredAmbient = null; // requested before audio is unlocked
    // Default ON; honour a saved preference.
    this.enabled = localStorage.getItem('wanderglobe_sound') !== 'off';
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  // Build the graph on the first user gesture. Safe to call repeatedly.
  unlock() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // no Web Audio — fail silently
    this.started = true;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    // A shared, synthetic plate reverb gives everything the same vast room.
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.2, 2.2);
    this.reverbReturn = this.ctx.createGain();
    this.reverbReturn.gain.value = 0.9;
    this.reverb.connect(this.reverbReturn).connect(this.master);

    this.ctx.resume();
    this._rampMaster();
    if (this.desiredAmbient) this._applyAmbient(this.desiredAmbient);
  }

  isEnabled() {
    return this.enabled;
  }

  // Mute / unmute — ramps the master gain and stores the preference.
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('wanderglobe_sound', this.enabled ? 'on' : 'off');
    this._rampMaster();
    if (this.enabled && this.ctx) this.click(); // little confirmation tick
    return this.enabled;
  }

  _rampMaster() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.enabled ? 0.55 : 0.0, t, 0.5);
  }

  // Route a node both dry (to master) and wet (a copy into the reverb).
  _send(node, wet = 0.5) {
    node.connect(this.master);
    const s = this.ctx.createGain();
    s.gain.value = wet;
    node.connect(s);
    s.connect(this.reverb);
  }

  // ── Buffers ──────────────────────────────────────────────────────────────────
  _impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  _noise(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── Ambient drones ───────────────────────────────────────────────────────────
  // Earth: a deep, slow space drone. Solar: higher and more open, with a faint
  // shimmer. Crossfades between the two when the view changes.
  setAmbient(type) {
    this.desiredAmbient = type;
    if (this.started) this._applyAmbient(type);
  }

  _applyAmbient(type) {
    if (!this.ctx || this.ambientType === type) return;
    const t = this.ctx.currentTime;

    if (this.ambient) {
      const old = this.ambient;
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setTargetAtTime(0, t, 1.0);
      old.sources.forEach((o) => {
        try { o.stop(t + 4); } catch (e) {}
      });
      setTimeout(() => {
        try { old.gain.disconnect(); } catch (e) {}
      }, 4500);
    }

    this.ambient = this._buildAmbient(type);
    this.ambientType = type;
    this.ambient.gain.gain.setTargetAtTime(this.ambient.level, t, 1.5);
  }

  _buildAmbient(type) {
    const ctx = this.ctx;
    const solar = type === 'solar';

    const gain = ctx.createGain();
    gain.gain.value = 0;
    this._send(gain, solar ? 0.85 : 0.55);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = solar ? 950 : 480;
    lowpass.Q.value = 0.6;
    lowpass.connect(gain);

    const freqs = solar ? [98, 146.83, 196, 261.63] : [55, 73.42, 110];
    const sources = [];

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;

      // a slow detune drift keeps the drone alive instead of static
      const drift = ctx.createOscillator();
      drift.type = 'sine';
      drift.frequency.value = 0.05 + i * 0.017;
      const driftGain = ctx.createGain();
      driftGain.gain.value = 4 + i * 2; // cents
      drift.connect(driftGain).connect(osc.detune);

      const og = ctx.createGain();
      og.gain.value = 0.2 / (i + 1);
      osc.connect(og).connect(lowpass);

      osc.start();
      drift.start();
      sources.push(osc, drift);
    });

    // very slow swell across the whole drone
    const swell = ctx.createOscillator();
    swell.type = 'sine';
    swell.frequency.value = solar ? 0.08 : 0.05;
    const swellGain = ctx.createGain();
    swellGain.gain.value = solar ? 0.22 : 0.16;
    swell.connect(swellGain).connect(gain.gain);
    swell.start();
    sources.push(swell);

    if (solar) {
      // faint high shimmer with a gentle tremolo
      const sh = ctx.createOscillator();
      sh.type = 'sine';
      sh.frequency.value = 587.33;
      const shGain = ctx.createGain();
      shGain.gain.value = 0.02;
      const trem = ctx.createOscillator();
      trem.type = 'sine';
      trem.frequency.value = 0.3;
      const tremGain = ctx.createGain();
      tremGain.gain.value = 0.015;
      trem.connect(tremGain).connect(shGain.gain);
      sh.connect(shGain).connect(gain);
      sh.start();
      trem.start();
      sources.push(sh, trem);
    }

    return { gain, sources, level: solar ? 0.5 : 0.62 };
  }

  // ── One-shot effects ─────────────────────────────────────────────────────────

  // Unique hover tone per body (a pleasant scale + per-planet timbre).
  hover(key) {
    if (!this.ctx) return;
    const map = {
      sun: [130.81, 'sawtooth'],
      mercury: [392.0, 'sine'],
      venus: [440.0, 'sine'],
      earth: [523.25, 'sine'],
      mars: [349.23, 'sine'],
      jupiter: [196.0, 'triangle'],
      saturn: [220.0, 'triangle'],
      uranus: [293.66, 'sine'],
      neptune: [261.63, 'triangle'],
      moon: [659.25, 'sine'],
    };
    const [freq, wave] = map[key] || [330, 'sine'];
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.6);
    osc.connect(lp).connect(g);
    this._send(g, 0.6);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  // Fly-to whoosh: filtered noise sweeping up then back down.
  whoosh() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise(1.1);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(180, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.45);
    bp.frequency.exponentialRampToValueAtTime(220, t + 1.0);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    src.connect(bp).connect(g);
    this._send(g, 0.7);
    src.start(t);
    src.stop(t + 1.1);
  }

  // Info-card chime: a soft inharmonic bell.
  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 1046.5; // C6
    [1, 2.01, 3.0, 4.2].forEach((p, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * p;
      const g = this.ctx.createGain();
      const peak = 0.12 / (i + 1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 1.8 - i * 0.25);
      osc.connect(g);
      this._send(g, 0.85);
      osc.start(t);
      osc.stop(t + 2);
    });
  }

  // Earth re-entry: a rising-then-falling wind plus a low rumble underlay.
  reentry() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this._noise(2.2);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(3000, t + 0.9);
    lp.frequency.exponentialRampToValueAtTime(500, t + 2.0);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.38, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.1);
    src.connect(lp).connect(g);
    this._send(g, 0.6);
    src.start(t);
    src.stop(t + 2.2);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 60;
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.22, t + 0.4);
    og.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    osc.connect(og);
    this._send(og, 0.5);
    osc.start(t);
    osc.stop(t + 1.9);
  }

  // Black-hole rumble: sub-bass oscillators with a slow amplitude wobble.
  // (Available as part of the kit; there is no black hole in the scene to
  // trigger it, per the project constraints.)
  rumble(duration = 6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 30;
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 45;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setTargetAtTime(0.5, t, 1.0);
    g.gain.setTargetAtTime(0.0001, t + duration - 1.5, 0.8);
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.25;
    lfo.connect(lfoG).connect(g.gain);
    osc.connect(g);
    sub.connect(g);
    this._send(g, 0.7);
    osc.start(t);
    sub.start(t);
    lfo.start(t);
    osc.stop(t + duration);
    sub.stop(t + duration);
    lfo.stop(t + duration);
  }

  // UI click: a tiny pitch-dropping oscillator burst.
  click() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.04);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
    osc.connect(lp).connect(g);
    this._send(g, 0.3);
    osc.start(t);
    osc.stop(t + 0.07);
  }
}
