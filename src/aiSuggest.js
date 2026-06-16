// AI Trip Suggester. Sends the traveller's visited + wishlisted countries to the
// Claude API (claude-sonnet-4-6) and renders 3 destination cards. The API key is
// entered once via a glassmorphism modal and kept only in localStorage.
//
// This is a browser-side call, so it uses raw fetch against /v1/messages with the
// anthropic-dangerous-direct-browser-access header (required for CORS). The model
// id (claude-sonnet-4-6) and max_tokens (1000) are fixed per the feature spec.

import { findCountryByName } from './countryData.js';

const KEY_STORE = 'wanderglobe_ai_key';
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const $ = (id) => document.getElementById(id);

function countryOfPin(pin) {
  if (!pin || !pin.name) return null;
  const parts = String(pin.name).split(',').map((s) => s.trim()).filter(Boolean);
  const tail = parts.length ? parts[parts.length - 1] : null;
  const c = tail ? findCountryByName(tail) : null;
  return c ? c.name : tail;
}

const BUDGET_CLASS = { budget: 'budget', mid: 'mid', luxury: 'luxury' };

export function createAISuggester({ getPins, addWishlistPin, sound }) {
  const overlay = $('ai-overlay');
  const body = $('ai-body');
  let open = false;

  function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { localStorage.setItem(KEY_STORE, k || ''); } catch (e) {} }

  function visitedList() {
    const set = new Set();
    for (const p of (getPins() || [])) if (p && p.type === 'visited') { const c = countryOfPin(p); if (c) set.add(c); }
    return [...set];
  }
  function wishlist() {
    const set = new Set();
    for (const p of (getPins() || [])) if (p && p.type === 'wishlist') { const c = countryOfPin(p); if (c) set.add(c); }
    return [...set];
  }

  function openOverlay() {
    open = true;
    overlay.classList.add('open');
    if (sound) sound.click();
    if (!getKey()) renderKeyPrompt();
    else run();
  }
  function close() {
    open = false;
    overlay.classList.remove('open');
  }

  // ── API key modal ──────────────────────────────────────────────────────────
  function renderKeyPrompt() {
    body.innerHTML = `
      <div class="ai-keybox">
        <div class="ai-key-icon">🔑</div>
        <h3>Enter your Anthropic API key to unlock AI suggestions</h3>
        <input id="ai-key-input" type="password" placeholder="sk-ant-..." autocomplete="off" />
        <button id="ai-key-save" class="btn-primary" type="button">Unlock suggestions</button>
        <p class="ai-key-note">Your key is stored only in your browser (localStorage) and sent directly to Anthropic.
          Get one at <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a>.</p>
      </div>`;
    const input = $('ai-key-input');
    input.focus();
    $('ai-key-save').addEventListener('click', () => {
      const k = input.value.trim();
      if (!k) { input.classList.add('error'); setTimeout(() => input.classList.remove('error'), 1000); return; }
      setKey(k);
      if (sound) sound.chime();
      run();
    });
  }

  function renderLoading() {
    body.innerHTML = `
      <div class="ai-loading">
        <div class="ai-spark">✨</div>
        <div class="ai-loading-text">Claude is thinking<span class="ai-dots"><i>.</i><i>.</i><i>.</i></span></div>
      </div>`;
  }

  function renderError(msg) {
    body.innerHTML = `
      <div class="ai-error">
        <div class="ai-error-icon">😕</div>
        <p>${msg || "Couldn't get suggestions right now."}</p>
        <div class="ai-error-actions">
          <button id="ai-retry" class="btn-primary" type="button">Try again</button>
          <button id="ai-rekey" class="btn-ghost" type="button">Change API key</button>
        </div>
      </div>`;
    $('ai-retry').addEventListener('click', run);
    $('ai-rekey').addEventListener('click', renderKeyPrompt);
  }

  // ── The call ───────────────────────────────────────────────────────────────
  async function run() {
    renderLoading();
    const visited = visitedList();
    const wished = wishlist();
    const prompt =
      `Based on someone who has visited [${visited.join(', ') || 'nowhere yet'}] and has wishlisted ` +
      `[${wished.join(', ') || 'nothing yet'}], suggest 3 perfect next travel destinations they haven't ` +
      `visited yet. For each: destination name, 2-sentence reason why it suits them, best month to visit, ` +
      `one must-do experience, estimated budget level (budget/mid/luxury). ` +
      `Respond with ONLY a JSON array of objects with keys: destination, reason, bestMonth, mustDo, budget. No prose, no markdown.`;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': getKey(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        let detail = '';
        try { const j = await res.json(); detail = j.error && j.error.message ? j.error.message : ''; } catch (e) {}
        if (res.status === 401) { renderError('That API key was rejected. Check it and try again.'); return; }
        renderError(detail || `Request failed (${res.status}).`);
        return;
      }
      const data = await res.json();
      const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      const suggestions = parseSuggestions(text);
      if (!suggestions.length) { renderError("Claude's reply couldn't be read. Try again."); return; }
      renderCards(suggestions);
      if (sound) sound.chime();
    } catch (e) {
      renderError('Network error reaching Claude. Check your connection and try again.');
    }
  }

  // Pull a JSON array out of the model's text, tolerating stray prose / fences.
  function parseSuggestions(text) {
    if (!text) return [];
    let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try { const a = JSON.parse(t); if (Array.isArray(a)) return a; } catch (e) {}
    const start = t.indexOf('[');
    const end = t.lastIndexOf(']');
    if (start >= 0 && end > start) {
      try { const a = JSON.parse(t.slice(start, end + 1)); if (Array.isArray(a)) return a; } catch (e) {}
    }
    return [];
  }

  function renderCards(list) {
    const cards = list.slice(0, 3).map((s, i) => {
      const budget = String(s.budget || 'mid').toLowerCase();
      const bClass = BUDGET_CLASS[budget] || 'mid';
      const country = findCountryByName(s.destination || '');
      const canPin = !!country;
      return `<div class="ai-card">
        <div class="ai-card-month">${esc(s.bestMonth || '')}</div>
        <h3 class="ai-card-dest">${country ? country.flag + ' ' : ''}${esc(s.destination || 'Somewhere')}</h3>
        <p class="ai-card-reason">${esc(s.reason || '')}</p>
        <div class="ai-card-must"><span>✶ Must-do</span> ${esc(s.mustDo || '')}</div>
        <div class="ai-card-foot">
          <span class="ai-budget ${bClass}">${budget}</span>
          ${canPin
            ? `<button class="ai-pin btn-ghost" type="button" data-i="${i}">📍 Pin to Wishlist</button>`
            : `<span class="ai-nopin">No coordinates</span>`}
        </div>
      </div>`;
    }).join('');
    body.innerHTML = `<p class="ai-eyebrow">✨ Claude suggests</p><div class="ai-cards">${cards}</div>
      <button id="ai-again" class="btn-ghost full" type="button">Suggest again</button>`;
    $('ai-again').addEventListener('click', run);
    body.querySelectorAll('.ai-pin').forEach((b) => b.addEventListener('click', () => {
      const s = list[Number(b.dataset.i)];
      const c = findCountryByName(s.destination || '');
      if (c && addWishlistPin(c.lat, c.lng, `${c.capital}, ${c.name}`)) {
        b.textContent = '✓ Pinned!';
        b.disabled = true;
      }
    }));
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  $('ai-close').addEventListener('click', () => { close(); if (sound) sound.click(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  return { open: openOverlay, close, isOpen: () => open };
}
