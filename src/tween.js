// A tiny tween system for smooth camera flights and screen fades.
//
// Call tween({...}) to start one; call updateTweens(now) once per frame from
// the render loop. Each tween reports progress as an eased value 0 → 1.

const active = [];

// Smooth acceleration then deceleration — feels natural for camera moves.
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// duration is in milliseconds. onUpdate(k) gets the eased 0..1 progress.
export function tween({ duration, onUpdate, onComplete, ease = easeInOutCubic }) {
  active.push({ start: null, duration, onUpdate, onComplete, ease });
}

// Advance every running tween using the current timestamp (performance.now()).
export function updateTweens(now) {
  for (let i = active.length - 1; i >= 0; i--) {
    const t = active[i];
    if (t.start === null) t.start = now;
    let k = (now - t.start) / t.duration;
    if (k > 1) k = 1;
    t.onUpdate(t.ease(k));
    if (k >= 1) {
      active.splice(i, 1);
      if (t.onComplete) t.onComplete();
    }
  }
}
