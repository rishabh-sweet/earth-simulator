// Travel Stats overlay — computes a traveller's stats from their saved pins and
// trips, renders a full-screen glassmorphism panel with animated counters, a
// donut breakdown, continents covered, a travel score, and a shareable summary.

const $ = (id) => document.getElementById(id);

// A compact country → continent map (country names as returned by the
// reverse-geocoder). Unknown countries simply don't count toward continents.
const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'];
const COUNTRY_CONTINENT = {
  // Asia
  india: 'Asia', china: 'Asia', japan: 'Asia', 'south korea': 'Asia', 'north korea': 'Asia', thailand: 'Asia',
  vietnam: 'Asia', indonesia: 'Asia', malaysia: 'Asia', singapore: 'Asia', philippines: 'Asia', cambodia: 'Asia',
  laos: 'Asia', myanmar: 'Asia', nepal: 'Asia', 'sri lanka': 'Asia', bangladesh: 'Asia', pakistan: 'Asia',
  'united arab emirates': 'Asia', 'saudi arabia': 'Asia', qatar: 'Asia', israel: 'Asia', turkey: 'Asia',
  jordan: 'Asia', lebanon: 'Asia', iran: 'Asia', iraq: 'Asia', kazakhstan: 'Asia', mongolia: 'Asia',
  'hong kong': 'Asia', taiwan: 'Asia', bhutan: 'Asia', maldives: 'Asia', oman: 'Asia', bahrain: 'Asia', kuwait: 'Asia',
  // Europe
  'united kingdom': 'Europe', england: 'Europe', scotland: 'Europe', ireland: 'Europe', france: 'Europe',
  germany: 'Europe', spain: 'Europe', portugal: 'Europe', italy: 'Europe', greece: 'Europe', netherlands: 'Europe',
  belgium: 'Europe', switzerland: 'Europe', austria: 'Europe', sweden: 'Europe', norway: 'Europe', denmark: 'Europe',
  finland: 'Europe', iceland: 'Europe', poland: 'Europe', 'czech republic': 'Europe', czechia: 'Europe',
  hungary: 'Europe', croatia: 'Europe', romania: 'Europe', russia: 'Europe', ukraine: 'Europe', 'the netherlands': 'Europe',
  // Africa
  egypt: 'Africa', morocco: 'Africa', 'south africa': 'Africa', kenya: 'Africa', tanzania: 'Africa', nigeria: 'Africa',
  ethiopia: 'Africa', ghana: 'Africa', tunisia: 'Africa', namibia: 'Africa', botswana: 'Africa', uganda: 'Africa',
  zimbabwe: 'Africa', zambia: 'Africa', senegal: 'Africa', rwanda: 'Africa',
  // North America
  'united states': 'North America', 'united states of america': 'North America', usa: 'North America',
  canada: 'North America', mexico: 'North America', cuba: 'North America', 'costa rica': 'North America',
  panama: 'North America', guatemala: 'North America', jamaica: 'North America', 'dominican republic': 'North America',
  bahamas: 'North America', 'puerto rico': 'North America',
  // South America
  brazil: 'South America', argentina: 'South America', chile: 'South America', peru: 'South America',
  colombia: 'South America', bolivia: 'South America', ecuador: 'South America', uruguay: 'South America',
  venezuela: 'South America', paraguay: 'South America',
  // Oceania
  australia: 'Oceania', 'new zealand': 'Oceania', fiji: 'Oceania', 'papua new guinea': 'Oceania',
  // Antarctica
  antarctica: 'Antarctica',
};

function continentOf(country) {
  if (!country) return null;
  return COUNTRY_CONTINENT[country.trim().toLowerCase()] || null;
}
function countryOf(pin) {
  // pin.name is "City, Country" → take the last comma-separated chunk
  if (!pin.name) return null;
  const parts = pin.name.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function haversine(a, b) {
  const R = 6371; // km
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export function createStatsOverlay({ getPins, getTrips }) {
  const overlay = $('stats-overlay');
  const grid = $('stats-grid');
  const scoreNum = $('score-num');
  const scoreRank = $('score-rank');
  const shareBtn = $('stats-share');
  const shareNote = $('stats-share-note');
  let open = false;
  let lastSummary = '';

  function compute() {
    const pins = getPins();
    const visited = pins.filter((p) => p.type === 'visited');
    const wishlist = pins.filter((p) => p.type === 'wishlist');

    const countries = new Set();
    const continentCounts = {};
    for (const p of visited) {
      const c = countryOf(p);
      if (c) countries.add(c.toLowerCase());
      const cont = continentOf(countryOf(p));
      if (cont) continentCounts[cont] = (continentCounts[cont] || 0) + 1;
    }
    const continents = Object.keys(continentCounts);

    // distance: sum great-circle hops between visited pins in date order
    const ordered = [...visited].sort((a, b) => (a.dateAdded || '').localeCompare(b.dateAdded || ''));
    let distance = 0;
    for (let i = 1; i < ordered.length; i++) distance += haversine(ordered[i - 1], ordered[i]);

    const mostRegion = continents.length
      ? continents.reduce((m, c) => (continentCounts[c] > continentCounts[m] ? c : m), continents[0])
      : '—';

    const score = Math.min(1000, countries.size * 10 + continents.length * 50 + visited.length * 2);
    const rank = score >= 700 ? 'Legend' : score >= 400 ? 'Globetrotter' : score >= 150 ? 'Adventurer' : 'Explorer';

    // longest trip: collection with the most pins (tie → widest date range)
    const trips = getTrips();
    let longestTrip = null;
    let bestPins = -1;
    for (const t of trips) {
      const ps = pins.filter((p) => p.tripId === t.id);
      if (ps.length > bestPins) { bestPins = ps.length; longestTrip = { name: `${t.emoji} ${t.name}`, count: ps.length }; }
    }

    const first = ordered.find((p) => p.dateAdded);

    return {
      countries: countries.size, continents, continentCounts, mostRegion,
      visited: visited.length, wishlist: wishlist.length, distance: Math.round(distance),
      score, rank, longestTrip, first,
    };
  }

  function donut(visited, wishlist) {
    const total = visited + wishlist;
    const vDeg = total ? (visited / total) * 360 : 0;
    return `conic-gradient(#ffce6a 0deg ${vDeg}deg, #7fb8ff ${vDeg}deg 360deg)`;
  }

  function render() {
    const s = compute();
    lastSummary = `I've visited ${s.countries} countries across ${s.continents.length} continents. Travel score: ${s.score}/1000 🌍 #Wanderglobe`;

    const contChips = CONTINENTS.map((c) =>
      `<span class="cont-chip ${s.continentCounts[c] ? 'on' : ''}">${c}</span>`).join('');

    grid.innerHTML = `
      <div class="stat-card accent-blue">
        <span class="sc-label">Countries visited</span>
        <span class="sc-num" data-count="${s.countries}">0</span>
      </div>
      <div class="stat-card accent-mint span-2">
        <span class="sc-label">Continents covered (${s.continents.length}/7)</span>
        <div class="cont-row">${contChips}</div>
      </div>
      <div class="stat-card accent-gold">
        <span class="sc-label">Pins</span>
        <div class="donut-wrap">
          <div class="donut" style="background:${donut(s.visited, s.wishlist)}"><div class="donut-hole">${s.visited + s.wishlist}</div></div>
          <div class="donut-legend">
            <span><i style="background:#ffce6a"></i> ${s.visited} visited</span>
            <span><i style="background:#7fb8ff"></i> ${s.wishlist} wishlist</span>
          </div>
        </div>
      </div>
      <div class="stat-card accent-coral">
        <span class="sc-label">Distance travelled</span>
        <span class="sc-num" data-count="${s.distance}" data-suffix=" km">0</span>
      </div>
      <div class="stat-card accent-blue">
        <span class="sc-label">Most-visited region</span>
        <span class="sc-text">${s.mostRegion}</span>
      </div>
      <div class="stat-card accent-mint">
        <span class="sc-label">Longest trip</span>
        <span class="sc-text">${s.longestTrip ? `${s.longestTrip.name} · ${s.longestTrip.count} pins` : '—'}</span>
      </div>
      <div class="stat-card accent-gold span-2">
        <span class="sc-label">First pin ever</span>
        <span class="sc-text">${s.first ? `${s.first.name}  ·  ${new Date(s.first.dateAdded).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}` : 'Drop your first pin!'}</span>
      </div>`;

    // animate the score + numeric counters
    countUp(scoreNum, s.score, 0, '');
    scoreRank.textContent = s.rank;
    grid.querySelectorAll('.sc-num').forEach((el) => countUp(el, Number(el.dataset.count || 0), 0, el.dataset.suffix || ''));
  }

  function countUp(el, target, decimals, suffix) {
    const dur = 1600;
    const start = performance.now();
    function tick(now) {
      if (!open) { el.textContent = target.toLocaleString() + suffix; return; }
      const k = Math.min((now - start) / dur, 1);
      const v = target * easeOutExpo(k);
      el.textContent = (decimals ? v.toFixed(decimals) : Math.round(v)).toLocaleString() + suffix;
      if (k < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString() + suffix;
    }
    requestAnimationFrame(tick);
  }

  function openOverlay() {
    open = true;
    shareNote.textContent = '';
    render();
    overlay.classList.add('open');
  }
  function close() {
    open = false;
    overlay.classList.remove('open');
  }

  $('stats-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  shareBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(lastSummary);
      shareNote.textContent = 'Copied to clipboard!';
    } catch (e) {
      shareNote.textContent = lastSummary;
    }
    setTimeout(() => { shareNote.textContent = ''; }, 4000);
  });

  return { open: openOverlay, close, isOpen: () => open };
}
