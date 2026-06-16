// Visa requirement checker. Fetches the free Passport Index matrix (CSV) once,
// parses it into passport → destination → requirement, and exposes a small
// badge for the country hover tooltip based on the user's saved passport.
//
// Dataset: ilyankou/passport-index-dataset (passport-index-matrix.csv). Rows are
// passport countries, columns destination countries; cell values are a number
// of visa-free days, or one of: "visa free", "visa on arrival", "e-visa",
// "visa required", "no admission", "-1" (same country). Everything is wrapped so
// a failed fetch simply yields no badge.

import { COUNTRIES, normalizeCountryName } from './countryData.js';

const PASSPORT_KEY = 'wanderglobe_passport';
const CSV_URL = 'https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-matrix.csv';

// Parse one CSV line, honouring simple double-quoted fields.
function parseLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Map a raw cell value to one of our four categories (+ 'self').
function classify(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === '-1' || v === '') return 'self';
  if (!isNaN(Number(v))) return 'free';            // a number of visa-free days
  if (v.includes('no admission') || v.includes('not admitted')) return 'none';
  if (v.includes('on arrival')) return 'arrival';
  if (v === 'visa free' || v === 'visa-free' || v === 'freedom of movement') return 'free';
  // e-visa / eta / visa required all need paperwork → "required"
  if (v.includes('e-visa') || v.includes('evisa') || v.includes('eta') || v.includes('visa required') || v.includes('required')) return 'required';
  return 'required';
}

const BADGES = {
  free:     { emoji: '✅', label: 'Visa free' },
  arrival:  { emoji: '🕐', label: 'Visa on arrival' },
  required: { emoji: '📋', label: 'Visa required' },
  none:     { emoji: '🚫', label: 'No admission' },
  self:     { emoji: '🏠', label: 'Home country' },
};

export function createVisaChecker({ sound } = {}) {
  let matrix = null;          // Map<normPassport, Map<normDest, category>>
  let colNames = [];          // normalized destination names, in column order
  let ready = false;

  // ── load + parse the matrix (once) ─────────────────────────────────────────
  (async function load() {
    try {
      const res = await fetch(CSV_URL, { cache: 'force-cache' });
      if (!res.ok) throw new Error('visa csv fetch failed');
      const text = await res.text();
      const lines = text.split(/\r?\n/).filter((l) => l.length);
      if (lines.length < 2) throw new Error('visa csv malformed');
      const header = parseLine(lines[0]);
      colNames = header.slice(1).map(normalizeCountryName);
      matrix = new Map();
      for (let i = 1; i < lines.length; i++) {
        const cells = parseLine(lines[i]);
        const passport = normalizeCountryName(cells[0]);
        if (!passport) continue;
        const row = new Map();
        for (let j = 1; j < cells.length; j++) {
          const dest = colNames[j - 1];
          if (dest) row.set(dest, classify(cells[j]));
        }
        matrix.set(passport, row);
      }
      ready = true;
    } catch (e) {
      ready = false; // graceful: no badges
    }
  })();

  function getPassport() {
    try { return localStorage.getItem(PASSPORT_KEY) || ''; } catch (e) { return ''; }
  }
  function setPassport(name) {
    try { localStorage.setItem(PASSPORT_KEY, name || ''); } catch (e) {}
  }

  // Look up the requirement category for the saved passport → destination name.
  function lookup(destName) {
    const passport = getPassport();
    if (!passport || !ready || !matrix) return null;
    const row = matrix.get(normalizeCountryName(passport));
    if (!row) return null;
    const cat = row.get(normalizeCountryName(destName));
    return cat || null;
  }

  // Small inline badge HTML for the country tooltip. Returns the "set passport"
  // hint when none is chosen, '' when we simply have no data for that country.
  function badgeHtml(destName) {
    const passport = getPassport();
    if (!passport) return `<span class="visa-hint">Set your passport in Profile to see visa info</span>`;
    const cat = lookup(destName);
    if (!cat) return '';
    const b = BADGES[cat];
    return `<span class="visa-badge ${cat}">${b.emoji} ${b.label}</span>`;
  }

  // ── Passport selector inside the Profile panel ─────────────────────────────
  function mountSelector() {
    const sel = document.getElementById('profile-passport');
    if (!sel) return;
    const sorted = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = '<option value="">— Select your passport —</option>' +
      sorted.map((c) => `<option value="${c.name}">${c.flag} ${c.name}</option>`).join('');
    sel.value = getPassport();
    sel.addEventListener('change', () => {
      setPassport(sel.value);
      if (sound) sound.click();
    });
  }

  return { lookup, badgeHtml, getPassport, setPassport, mountSelector, isReady: () => ready };
}
