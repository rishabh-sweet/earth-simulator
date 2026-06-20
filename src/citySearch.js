// City search — Nominatim geocoding with camera fly-to and a "Pin here?" prompt.
// Collapses to a 🔍 icon when idle; expands to a glassmorphism search bar.
// Results debounced at 400ms to respect Nominatim's usage policy.

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const $ = (id) => document.getElementById(id);

export function createCitySearch({ flyTo, openAddAtLatLng, sound }) {
  const wrap      = $('city-search');
  const iconBtn   = $('search-toggle');
  const expanded  = $('search-expanded');
  const input     = $('search-input');
  const closeBtn  = $('search-close');
  const results   = $('search-results');
  const prompt    = $('search-pin-prompt');
  const pinBtn    = $('search-pin-btn');
  const pinX      = $('search-pin-dismiss');

  let debounceTimer = null;
  let promptTimer   = null;
  let pending       = null; // { lat, lng, name } of the last fly-to target

  // ── Expand / collapse ──────────────────────────────────────────────────────
  function expand() {
    expanded.hidden = false;
    iconBtn.hidden  = true;
    setTimeout(() => input.focus(), 60);
    if (sound) sound.click();
  }
  function collapse() {
    expanded.hidden = true;
    iconBtn.hidden  = false;
    results.hidden  = true;
    results.innerHTML = '';
    input.value = '';
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    if (sound) sound.click();
  }

  function show() { wrap.classList.add('visible'); }
  function hide() { collapse(); wrap.classList.remove('visible'); }

  iconBtn.addEventListener('click', expand);
  closeBtn.addEventListener('click', collapse);
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') collapse(); });

  // ── Nominatim search (debounced 400ms) ─────────────────────────────────────
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) { results.hidden = true; results.innerHTML = ''; return; }
    debounceTimer = setTimeout(() => fetchResults(q), 400);
  });

  async function fetchResults(q) {
    try {
      const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) throw new Error('nominatim error');
      const data = await res.json();
      renderResults(data);
    } catch (e) {
      results.innerHTML = '<div class="sr-item sr-msg">Network error — check your connection</div>';
      results.hidden = false;
    }
  }

  function renderResults(data) {
    if (!data || !data.length) {
      results.innerHTML = '<div class="sr-item sr-msg">No places found</div>';
      results.hidden = false;
      return;
    }
    results.innerHTML = data.map((place, i) => {
      const parts = (place.display_name || '').split(',');
      const primary = parts.slice(0, 2).join(',').trim();
      const country = place.address?.country || '';
      const fullName = primary + (country && !primary.endsWith(country) ? ', ' + country : '');
      return `<button class="sr-item" data-lat="${place.lat}" data-lng="${place.lon}"
          data-name="${esc(fullName)}" type="button">
        <span class="sr-name">${esc(primary)}</span>
        ${country ? `<span class="sr-country">${esc(country)}</span>` : ''}
      </button>`;
    }).join('');
    results.hidden = false;
  }

  results.addEventListener('click', (e) => {
    const btn = e.target.closest('.sr-item[data-lat]');
    if (!btn) return;
    const lat  = parseFloat(btn.dataset.lat);
    const lng  = parseFloat(btn.dataset.lng);
    const name = btn.dataset.name || '';
    pending = { lat, lng, name };
    flyTo(lat, lng);
    collapse();
    hidePinPrompt();
    // Show prompt after the 1.2s camera flight completes
    setTimeout(showPinPrompt, 1400);
    if (sound) sound.chime();
  });

  // ── "Pin here?" prompt ─────────────────────────────────────────────────────
  function showPinPrompt() {
    if (!pending) return;
    prompt.hidden = false;
    clearTimeout(promptTimer);
    promptTimer = setTimeout(hidePinPrompt, 8000); // auto-dismiss after 8s
  }
  function hidePinPrompt() {
    prompt.hidden = true;
    clearTimeout(promptTimer);
  }

  pinBtn.addEventListener('click', () => {
    if (!pending) return;
    openAddAtLatLng(pending.lat, pending.lng, pending.name);
    hidePinPrompt();
    pending = null;
    if (sound) sound.click();
  });
  pinX.addEventListener('click', () => { hidePinPrompt(); pending = null; });

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  return { show, hide, collapse };
}
