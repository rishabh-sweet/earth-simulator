// Year in Review — a Spotify-Wrapped-style full-screen slide recap of the
// traveller's year, computed from their pins + trips. Auto-advances every 4s,
// tap to skip forward, close button (or tapping past the last slide) to exit.
// A small year selector switches between years.

import { findCountryByName } from './countryData.js';

const $ = (id) => document.getElementById(id);
const SLIDE_MS = 4000;

function countryOfPin(pin) {
  if (!pin || !pin.name) return null;
  const parts = String(pin.name).split(',').map((s) => s.trim()).filter(Boolean);
  const tail = parts.length ? parts[parts.length - 1] : null;
  return tail ? findCountryByName(tail) : null;
}

export function createYearReview({ getPins, getTrips, sound }) {
  const overlay = $('year-overlay');
  const stage = $('year-stage');
  const yearLabel = $('year-label');

  let open = false;
  let year = pickDefaultYear();
  let slides = [];
  let idx = 0;
  let timer = null;

  function pickDefaultYear() {
    const now = new Date();
    return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  }

  // ── Compute the year's story ───────────────────────────────────────────────
  function compute(y) {
    const pins = (getPins() || []).filter((p) => {
      if (!p.dateAdded) return false;
      const d = new Date(p.dateAdded);
      return !isNaN(d) && d.getFullYear() === y;
    });
    const visited = pins.filter((p) => p.type === 'visited');

    const countrySet = new Set();
    const regionCounts = {};
    for (const p of visited) {
      const c = countryOfPin(p);
      if (c) {
        countrySet.add(c.name);
        if (c.continent) regionCounts[c.continent] = (regionCounts[c.continent] || 0) + 1;
      }
    }
    const regions = Object.keys(regionCounts);
    const topRegion = regions.length
      ? regions.reduce((m, r) => (regionCounts[r] > regionCounts[m] ? r : m), regions[0])
      : '—';

    // longest trip: collection with the most pins added this year
    const trips = getTrips() || [];
    let longestTrip = null;
    let best = 0;
    for (const t of trips) {
      const n = pins.filter((p) => p.tripId === t.id).length;
      if (n > best) { best = n; longestTrip = `${t.emoji} ${t.name}`; }
    }

    const score = Math.min(1000, countrySet.size * 10 + regions.length * 50 + pins.length * 2);
    const rank = score >= 700 ? 'Legend' : score >= 400 ? 'Globetrotter' : score >= 150 ? 'Adventurer' : 'Explorer';

    const ordered = [...pins].sort((a, b) => (a.dateAdded || '').localeCompare(b.dateAdded || ''));
    const first = ordered[0] || null;

    return {
      y, countries: countrySet.size, topRegion, pins: pins.length,
      longestTrip, score, rank, first, pinObjs: pins,
    };
  }

  // Build a small CSS mini-globe with optional pin dots overlaid.
  function miniGlobe(extraClass) {
    return `<div class="mini-globe ${extraClass || ''}"><span class="mg-sheen"></span></div>`;
  }

  function buildSlides(s) {
    const next = s.y + 1;
    return [
      `<div class="yr-slide">${miniGlobe('big')}
        <div class="yr-eyebrow">Your year in travel</div>
        <div class="yr-big">${s.y}</div></div>`,

      `<div class="yr-slide"><div class="yr-eyebrow">You visited</div>
        <div class="yr-count" data-count="${s.countries}">0</div>
        <div class="yr-sub">countr${s.countries === 1 ? 'y' : 'ies'}</div>
        <div class="yr-confetti">${confetti()}</div></div>`,

      `<div class="yr-slide">${miniGlobe('glow')}
        <div class="yr-eyebrow">Your favourite corner of the world</div>
        <div class="yr-mid">${s.topRegion}</div></div>`,

      `<div class="yr-slide"><div class="yr-eyebrow">You dropped</div>
        <div class="yr-count" data-count="${s.pins}">0</div>
        <div class="yr-sub">pins on the globe</div>
        <div class="yr-pindrops">${pinDrops(s.pins)}</div></div>`,

      `<div class="yr-slide"><div class="yr-eyebrow">Your biggest journey</div>
        <div class="yr-mid">${s.longestTrip ? esc(s.longestTrip) : 'A year of solo pins'}</div></div>`,

      `<div class="yr-slide"><div class="yr-eyebrow">Your travel score</div>
        <div class="yr-count" data-count="${s.score}">0</div>
        <div class="yr-sub">out of 1000</div>
        <div class="yr-rank">${s.rank}</div></div>`,

      `<div class="yr-slide"><div class="yr-eyebrow">Where it all began</div>
        <div class="yr-mid">${s.first ? esc(s.first.name) : 'No pins yet this year'}</div>
        ${s.first && s.first.photoBase64 ? `<img class="yr-photo" src="${s.first.photoBase64}" alt="" />` : ''}</div>`,

      `<div class="yr-slide">${miniGlobe('big')}
        <div class="yr-big small">See you in ${next} 🌍</div>
        <button id="year-share" class="btn-primary" type="button">Share my ${s.y} Wrapped</button>
        <div id="year-share-note" class="yr-share-note"></div></div>`,
    ];
  }

  function confetti() {
    return Array.from({ length: 30 }, (_, k) => {
      const hue = ['#ffd479', '#ffe2a6', '#fff3cf', '#f0a93a'][k % 4];
      return `<i style="left:${(k * 3.3) % 100}%;background:${hue};animation-delay:${(k % 9) * 0.12}s"></i>`;
    }).join('');
  }
  function pinDrops(n) {
    const count = Math.min(n, 24);
    return Array.from({ length: count }, (_, k) => {
      const top = 18 + ((k * 37) % 64);
      const left = 8 + ((k * 53) % 84);
      return `<span class="yr-pindot" style="top:${top}%;left:${left}%;animation-delay:${k * 0.12}s"></span>`;
    }).join('');
  }

  // ── Slide playback ─────────────────────────────────────────────────────────
  function show(i) {
    idx = i;
    stage.innerHTML = slides[i];
    requestAnimationFrame(() => {
      const el = stage.querySelector('.yr-slide');
      if (el) el.classList.add('in');
    });
    // count-up numbers
    const counter = stage.querySelector('.yr-count');
    if (counter) countUp(counter, Number(counter.dataset.count || 0));
    // wire the share button on the last slide
    const shareBtn = $('year-share');
    if (shareBtn) shareBtn.addEventListener('click', share);
    if (sound) sound.click();
    resetTimer();
  }

  function countUp(el, target) {
    const dur = 1400;
    const start = performance.now();
    function tick(now) {
      if (!open) { el.textContent = target.toLocaleString(); return; }
      const k = Math.min((now - start) / dur, 1);
      const v = target * (1 - Math.pow(2, -10 * k));
      el.textContent = Math.round(v).toLocaleString();
      if (k < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString();
    }
    requestAnimationFrame(tick);
  }

  function next() {
    if (idx >= slides.length - 1) { close(); return; }
    show(idx + 1);
  }
  function resetTimer() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(next, SLIDE_MS);
  }

  function load(y) {
    year = y;
    yearLabel.textContent = String(y);
    slides = buildSlides(compute(y));
    show(0);
  }

  function share() {
    const s = compute(year);
    const text = `My ${year} in travel: ${s.countries} countries, ${s.pins} pins, travel score ${s.score}/1000. Built on Wanderglobe 🌍`;
    const note = $('year-share-note');
    navigator.clipboard.writeText(text).then(
      () => { if (note) note.textContent = 'Copied to clipboard!'; },
      () => { if (note) note.textContent = text; }
    );
    if (sound) sound.chime();
  }

  function openOverlay() {
    open = true;
    overlay.classList.add('open');
    load(year);
  }
  function close() {
    open = false;
    if (timer) clearTimeout(timer);
    overlay.classList.remove('open');
  }

  // Tap the stage to skip forward; arrows change year; × closes.
  stage.addEventListener('click', next);
  $('year-prev').addEventListener('click', (e) => { e.stopPropagation(); load(year - 1); });
  $('year-next').addEventListener('click', (e) => { e.stopPropagation(); load(year + 1); });
  $('year-close').addEventListener('click', () => { close(); if (sound) sound.click(); });

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  return { open: openOverlay, close, isOpen: () => open };
}
