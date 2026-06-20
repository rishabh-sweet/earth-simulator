// Ambient country music — procedural Web Audio snippets crossfaded by geographic region.
// Activates when the camera hovers over a region for 3+ seconds.

// Region → continent mapping (simplified lat/lng bounding boxes)
function getRegion(lat, lng) {
  if (lat > 35 && lng > -15 && lng < 45)   return 'europe';
  if (lat > 0  && lng > 45  && lng < 180)  return 'asia';
  if (lat > 10 && lng > -20 && lng < 60 && lat < 40) return 'middleeast';
  if (lat > 25 && lng > -170 && lng < -30) return 'americas';
  if (lat < 35 && lat > -40 && lng > -20 && lng < 55) return 'africa';
  if (lat < -10 && lng > 100) return 'oceania';
  if (lat < 35  && lat > -55 && lng > -85 && lng < -30) return 'americas';
  return null;
}

// Simple polyphonic note player
function playNote(ctx, masterGain, freq, type, startT, duration, maxGain = 0.06) {
  const osc  = ctx.createOscillator();
  const env  = ctx.createGain();
  osc.type      = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0, startT);
  env.gain.linearRampToValueAtTime(maxGain, startT + 0.04);
  env.gain.setValueAtTime(maxGain, startT + duration - 0.06);
  env.gain.linearRampToValueAtTime(0, startT + duration);
  osc.connect(env);
  env.connect(masterGain);
  osc.start(startT);
  osc.stop(startT + duration + 0.05);
}

// Region → sequence of [freq, duration, gain] notes (loopable, ~4s)
const SEQUENCES = {
  europe: [
    [261.6, 0.4], [329.6, 0.4], [392.0, 0.4], [523.3, 0.8],
    [392.0, 0.3], [329.6, 0.3], [261.6, 0.6],
  ],
  asia: [ // pentatonic
    [293.7, 0.5], [330.0, 0.5], [440.0, 0.5], [493.9, 0.5],
    [587.3, 0.8], [440.0, 0.4], [293.7, 0.8],
  ],
  middleeast: [ // minor + aug 2nd
    [261.6, 0.4], [293.7, 0.4], [311.1, 0.4], [369.9, 0.6],
    [311.1, 0.3], [293.7, 0.3], [261.6, 0.6],
  ],
  americas: [
    [349.2, 0.3], [392.0, 0.3], [440.0, 0.3], [523.3, 0.3],
    [440.0, 0.4], [392.0, 0.4], [349.2, 0.5],
  ],
  africa: [
    [220.0, 0.3], [261.6, 0.3], [293.7, 0.2], [329.6, 0.3],
    [293.7, 0.2], [261.6, 0.3], [220.0, 0.4], [174.6, 0.5],
  ],
  oceania: [
    [392.0, 0.6], [523.3, 0.6], [659.3, 0.6],
    [523.3, 0.4], [392.0, 0.8],
  ],
};

export function createAmbientMusic(sound) {
  let ctx          = null;
  let masterGain   = null;
  let currentRegion = null;
  let hoverRegion  = null;
  let hoverStart   = 0;
  const TRIGGER_S  = 3.0;
  let loopTimer    = null;
  let active       = false;
  const FADE_TIME  = 1.5;

  function ensureCtx() {
    if (ctx) return;
    try {
      ctx        = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(ctx.destination);
    } catch {}
  }

  function playSequence(region) {
    if (!ctx || !masterGain) return;
    const seq = SEQUENCES[region];
    if (!seq) return;

    const type = (region === 'europe') ? 'sine' : (region === 'middleeast') ? 'triangle' : 'sine';
    let t = ctx.currentTime + 0.05;
    for (const [freq, dur] of seq) {
      playNote(ctx, masterGain, freq, type, t, dur, 0.055);
      t += dur;
    }
    // Loop
    const total = seq.reduce((s, [, d]) => s + d, 0);
    loopTimer = setTimeout(() => { if (active && currentRegion === region) playSequence(region); }, total * 1000);
  }

  function fadeIn(region) {
    if (!ctx) return;
    currentRegion = region;
    active        = true;
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + FADE_TIME);
    playSequence(region);
  }

  function fadeOut() {
    if (!ctx || !masterGain) return;
    active = false;
    if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_TIME);
    currentRegion = null;
  }

  return {
    // Called every frame with current lat/lng under camera (or null if no hit)
    update(lat, lng) {
      if (!sound.isEnabled()) { if (active) fadeOut(); return; }
      ensureCtx();
      if (ctx?.state === 'suspended') ctx.resume().catch(() => {});

      const region = (lat != null && lng != null) ? getRegion(lat, lng) : null;

      if (region !== hoverRegion) {
        hoverRegion = region;
        hoverStart  = performance.now();
      }

      if (!region) {
        if (active) fadeOut();
        return;
      }

      const elapsed = (performance.now() - hoverStart) / 1000;
      if (elapsed >= TRIGGER_S && region !== currentRegion) {
        if (active) fadeOut();
        setTimeout(() => fadeIn(region), FADE_TIME * 1000);
      }
    },

    stop() { fadeOut(); },
    dispose() { if (loopTimer) clearTimeout(loopTimer); ctx?.close().catch(() => {}); },
  };
}
