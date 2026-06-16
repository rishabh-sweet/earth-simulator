// "Surprise Me" — picks a random country the traveller hasn't visited yet, flies
// the camera to its capital, and shows a fun info card (flag, capital, popation,
// a surprising fact) with actions to wishlist it or roll again. The button does
// a quick dice-roll spin on each press.

import { COUNTRIES, findCountryByName } from './countryData.js';

const $ = (id) => document.getElementById(id);

function countryOfPin(pin) {
  if (!pin || !pin.name) return null;
  const parts = String(pin.name).split(',').map((s) => s.trim()).filter(Boolean);
  const tail = parts.length ? parts[parts.length - 1] : null;
  return tail ? findCountryByName(tail) : null;
}

export function createSurprise({ getPins, addWishlistPin, flyTo, sound }) {
  const btn = $('btn-surprise');
  const card = $('surprise-card');
  let current = null;
  let open = false;

  function visitedNames() {
    const set = new Set();
    for (const p of (getPins() || [])) {
      if (p && p.type === 'visited') { const c = countryOfPin(p); if (c) set.add(c.name); }
    }
    return set;
  }

  function pick() {
    const visited = visitedNames();
    const pool = COUNTRIES.filter((c) => !visited.has(c.name));
    const list = pool.length ? pool : COUNTRIES;
    // vary the choice without Math.random dependence on a single call
    return list[Math.floor(Math.random() * list.length)];
  }

  function render(c) {
    current = c;
    card.innerHTML = `
      <button id="surprise-close" class="sheet-x" aria-label="Close">×</button>
      <div class="surprise-flag">${c.flag}</div>
      <div class="surprise-name">${c.name}</div>
      <div class="surprise-rows">
        <div class="srow"><span>Capital</span><span>${c.capital || '—'}</span></div>
        <div class="srow"><span>Population</span><span>${(c.population || 0).toLocaleString()}</span></div>
        <div class="srow"><span>Continent</span><span>${c.continent || '—'}</span></div>
      </div>
      <div class="surprise-fact">${c.fact || ''}</div>
      <div class="surprise-actions">
        <button id="surprise-pin" class="btn-primary" type="button">📍 Pin to Wishlist</button>
        <button id="surprise-again" class="btn-ghost" type="button">🎲 Surprise me again</button>
      </div>`;
    $('surprise-close').addEventListener('click', close);
    $('surprise-pin').addEventListener('click', () => {
      if (addWishlistPin(c.lat, c.lng, `${c.capital}, ${c.name}`)) {
        const b = $('surprise-pin');
        b.textContent = '✓ Pinned!';
        b.disabled = true;
      }
    });
    $('surprise-again').addEventListener('click', roll);
  }

  function reveal(c) {
    render(c);
    card.classList.add('show');
    open = true;
    if (flyTo) flyTo(c.lat, c.lng);
  }

  function roll() {
    if (sound) sound.click();
    btn.classList.remove('rolling');
    // restart the CSS dice-roll animation
    void btn.offsetWidth;
    btn.classList.add('rolling');
    const c = pick();
    reveal(c);
  }

  function close() {
    open = false;
    card.classList.remove('show');
    if (sound) sound.click();
  }

  if (btn) btn.addEventListener('click', roll);

  return { roll, close, isOpen: () => open };
}
