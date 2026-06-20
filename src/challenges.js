// Travel challenges / achievements. A hardcoded set of milestones that are
// re-evaluated automatically whenever the pin data changes (and when cinematic
// mode is used). Newly unlocked challenges fire a celebratory confetti toast.
//
// Persistence: wanderglobe_challenges holds { unlocked: { id: ISODate }, flags }
// where `flags.cinematic` records that the user has run cinematic mode at least
// once (the only milestone that leaves no other trace in localStorage).

import { findCountryByName } from './countryData.js';

const KEY = 'wanderglobe_challenges';
const $ = (id) => document.getElementById(id);

// id, icon, title, description, and a predicate over the computed `facts`.
const CHALLENGES = [
  { id: 'first',     icon: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', title: 'First Steps',    desc: 'Add your first pin',                test: (f) => f.totalPins >= 1 },
  { id: 'flyer',     icon: '<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>', title: 'Frequent Flyer', desc: 'Visit 5 countries',                 test: (f) => f.visitedCountries >= 5 },
  { id: 'citizen',   icon: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>', title: 'World Citizen',  desc: 'Visit 20 countries',                test: (f) => f.visitedCountries >= 20 },
  { id: 'legend',    icon: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>', title: 'Legend',         desc: 'Visit 50 countries',                test: (f) => f.visitedCountries >= 50 },
  { id: 'island',    icon: '<path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/><path d="M2 18c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>', title: 'Island Hopper',  desc: 'Pin 3 island nations',              test: (f) => f.islandNations >= 3 },
  { id: 'summit',    icon: '<polygon points="12 2 22 20 2 20"/><polyline points="8 14 12 10 16 14"/>', title: 'Summit Seeker',  desc: 'Pin Nepal, Peru, or Switzerland',   test: (f) => f.summitSeeker },
  { id: 'sunrise',   icon: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2"/>', title: 'Sunrise Chaser', desc: 'Add a pin at 5–7am local time',     test: (f) => f.sunrisePin },
  { id: 'planner',   icon: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/>', title: 'Planner',        desc: 'Create your first trip collection', test: (f) => f.trips >= 1 },
  { id: 'director',  icon: '<rect x="2" y="7" width="13" height="10" rx="1"/><path d="M15 9l6-3v12l-6-3"/>', title: 'Director',       desc: 'Use cinematic mode',                test: (f) => f.cinematic },
  { id: 'seven',     icon: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/>', title: 'Seven Summits',  desc: 'Pin all 7 continents',              test: (f) => f.continents >= 7 },
  { id: 'nightowl',  icon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>', title: 'Night Owl',      desc: 'Add a pin after midnight local time', test: (f) => f.nightPin },
  { id: 'dreamer',   icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', title: 'Dreamer',        desc: 'Add 10 wishlist pins',              test: (f) => f.wishlistPins >= 10 },
];

const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'];

// The country a pin sits in, from its "City, Country" name. Returns the matched
// dataset entry (with continent / island), or null.
function countryOfPin(pin) {
  if (!pin || !pin.name) return null;
  const parts = String(pin.name).split(',').map((s) => s.trim()).filter(Boolean);
  const tail = parts.length ? parts[parts.length - 1] : null;
  return tail ? findCountryByName(tail) : null;
}

// Local clock hour at the pin's longitude when it was added (rough solar time:
// UTC shifted by lng/15 hours). Returns null when there's no timestamp.
function localHourOf(pin) {
  if (!pin || !pin.dateAdded) return null;
  const d = new Date(pin.dateAdded);
  if (isNaN(d)) return null;
  const utc = d.getUTCHours() + d.getUTCMinutes() / 60;
  let h = (utc + (pin.lng || 0) / 15) % 24;
  if (h < 0) h += 24;
  return h;
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return { unlocked: s.unlocked || {}, flags: s.flags || {} };
  } catch (e) {}
  return { unlocked: {}, flags: {} };
}

export function createChallenges({ getPins, getTrips, sound }) {
  const btn = $('btn-challenges');
  const overlay = $('challenges-overlay');
  const grid = $('challenges-grid');
  const bar = $('challenges-bar-fill');
  const countEl = $('challenges-count');
  const toast = $('challenge-toast');

  let state = loadState();
  let open = false;
  let unlockListener = null;

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // Roll up everything the predicates need from the current pins + trips.
  function computeFacts() {
    const pins = getPins() || [];
    const trips = getTrips() || [];
    const visitedCountrySet = new Set();
    const islandSet = new Set();
    const continentSet = new Set();
    let totalPins = 0;
    let wishlistPins = 0;
    let summitSeeker = false;
    let sunrisePin = false;
    let nightPin = false;

    for (const p of pins) {
      if (!p) continue;
      totalPins++;
      if (p.type === 'wishlist') wishlistPins++;
      const c = countryOfPin(p);
      if (c) {
        if (p.type === 'visited') visitedCountrySet.add(c.name);
        if (c.island) islandSet.add(c.name);
        if (c.continent) continentSet.add(c.continent);
        if (['Nepal', 'Peru', 'Switzerland'].includes(c.name)) summitSeeker = true;
      }
      const h = localHourOf(p);
      if (h != null) {
        if (h >= 5 && h < 7) sunrisePin = true;
        if (h >= 0 && h < 5) nightPin = true;
      }
    }

    return {
      totalPins,
      wishlistPins,
      visitedCountries: visitedCountrySet.size,
      islandNations: islandSet.size,
      continents: continentSet.size,
      summitSeeker,
      sunrisePin,
      nightPin,
      trips: trips.length,
      cinematic: !!state.flags.cinematic,
    };
  }

  // Evaluate every challenge; unlock + celebrate any that newly pass.
  function check() {
    const facts = computeFacts();
    let newlyUnlocked = [];
    for (const c of CHALLENGES) {
      if (state.unlocked[c.id]) continue;
      if (c.test(facts)) {
        state.unlocked[c.id] = new Date().toISOString();
        newlyUnlocked.push(c);
        if (unlockListener) unlockListener(c.id, state.unlocked[c.id]);
      }
    }
    if (newlyUnlocked.length) {
      persist();
      if (open) render();
      // celebrate one at a time so each gets its moment
      newlyUnlocked.forEach((c, i) => setTimeout(() => celebrate(c), i * 2600));
    }
    return facts;
  }

  function markCinematicUsed() {
    if (state.flags.cinematic) return;
    state.flags.cinematic = true;
    persist();
    check();
  }

  // ── Celebratory toast with pure-CSS confetti ───────────────────────────────
  let toastTimer = null;
  function celebrate(c) {
    if (sound) sound.chime();
    const confetti = Array.from({ length: 26 }, (_, k) => {
      const hue = [ '#ffd479', '#7fb8ff', '#ff6b8a', '#00e5cc', '#c49bff' ][k % 5];
      const left = Math.round((k / 26) * 100);
      const delay = (k % 7) * 0.06;
      const dur = 1.1 + (k % 5) * 0.18;
      const rot = (k * 47) % 360;
      return `<i style="left:${left}%;background:${hue};animation-delay:${delay}s;animation-duration:${dur}s;transform:rotate(${rot}deg)"></i>`;
    }).join('');
    toast.innerHTML =
      `<div class="confetti">${confetti}</div>` +
      `<div class="ct-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">${c.icon}</svg></div>` +
      `<div class="ct-text"><span class="ct-eyebrow">Challenge unlocked</span>` +
      `<span class="ct-title">${c.title}</span><span class="ct-desc">${c.desc}</span></div>`;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
  }

  // ── Full-screen panel ──────────────────────────────────────────────────────
  function render() {
    const done = CHALLENGES.filter((c) => state.unlocked[c.id]).length;
    countEl.textContent = `${done}/${CHALLENGES.length}`;
    bar.style.width = `${(done / CHALLENGES.length) * 100}%`;
    grid.innerHTML = CHALLENGES.map((c) => {
      const date = state.unlocked[c.id];
      const unlocked = !!date;
      const when = unlocked
        ? new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : '';
      return `<div class="challenge-card ${unlocked ? 'unlocked' : 'locked'}">
        <div class="ch-emoji">${unlocked ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">${c.icon}</svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`}</div>
        <div class="ch-title">${c.title}</div>
        <div class="ch-desc">${c.desc}</div>
        <div class="ch-foot">${unlocked ? 'Unlocked ' + when : 'Locked'}</div>
      </div>`;
    }).join('');
  }

  function openOverlay() {
    check();
    render();
    open = true;
    overlay.classList.add('open');
    if (sound) sound.click();
  }
  function close() {
    open = false;
    overlay.classList.remove('open');
  }

  if (btn) btn.addEventListener('click', openOverlay);
  $('challenges-close').addEventListener('click', () => { close(); if (sound) sound.click(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // initial silent reconciliation (don't toast on page load) — mark anything
  // already-earned as unlocked without celebrating it.
  (function reconcile() {
    const facts = (function () {
      const f = computeFacts();
      return f;
    })();
    for (const c of CHALLENGES) {
      if (!state.unlocked[c.id] && c.test(facts)) state.unlocked[c.id] = new Date().toISOString();
    }
    persist();
  })();

  // Merge an unlock map fetched from Supabase into local state (union, never remove).
  function setMergeUnlocked(map) {
    if (!map || typeof map !== 'object') return;
    let changed = false;
    for (const [id, date] of Object.entries(map)) {
      if (!state.unlocked[id]) { state.unlocked[id] = date; changed = true; }
    }
    if (changed) { persist(); if (open) render(); }
  }

  return {
    check, markCinematicUsed, open: openOverlay, close, isOpen: () => open,
    setOnUnlock: (fn) => { unlockListener = fn; },
    setMergeUnlocked,
  };
}
