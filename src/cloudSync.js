// Cloud sync layer over Supabase. Supabase is the source of truth; localStorage
// is a fast local cache. Every operation is wrapped so a network/Supabase failure
// degrades silently to localStorage and surfaces a "⚠️ Offline" indicator.
//
// Tables (see supabase/schema.sql):
//   users      (email pk, slug unique, name, data jsonb)
//   pins       (id pk,    user_email, data jsonb)
//   trips      (id pk,    user_email, data jsonb)
//   challenges (user_email, challenge_id, unlocked_at, pk(user_email,challenge_id))

import { supabase } from './supabase.js';

// ── Status indicator ("☁️ Syncing…" / "✓ Saved" / "⚠️ Offline") ─────────────
let inflight = 0;
let errored = false;
let hideTimer = null;

function statusEl() { return document.getElementById('sync-status'); }
function setStatus(state, text) {
  const el = statusEl();
  if (!el) return;
  el.textContent = text;
  el.className = 'sync-status show ' + state;
}
function hideStatus() { const el = statusEl(); if (el) el.classList.remove('show'); }

function begin() {
  if (inflight === 0) errored = false;
  inflight++;
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  setStatus('syncing', '☁️ Syncing…');
}
function end(ok) {
  if (!ok) errored = true;
  inflight = Math.max(0, inflight - 1);
  if (inflight > 0) return;
  if (errored) { setStatus('offline', '⚠️ Offline'); hideTimer = setTimeout(hideStatus, 2600); }
  else { setStatus('saved', '✓ Saved'); hideTimer = setTimeout(hideStatus, 2000); }
}

// Run a Supabase task with the status indicator; returns its value, or undefined
// on failure (so callers fall back to localStorage silently).
async function track(fn) {
  begin();
  try { const r = await fn(); end(true); return r; }
  catch (e) { end(false); return undefined; }
}
function throwIf(error) { if (error) throw error; }

// A URL-safe slug for an email, e.g. "rishabh@toto.co" → "rishabh-toto-co".
export function emailSlug(email) {
  return String(email || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function createCloudSync() {
  // ── Users ──────────────────────────────────────────────────────────────────
  // Fetch the cloud profile; if absent, seed it from the local user. Returns the
  // authoritative user object, or undefined when offline (keep local).
  async function resolveUser(localUser) {
    const email = localUser && localUser.email;
    if (!email) return undefined;
    return track(async () => {
      const { data, error } = await supabase.from('users').select('data').eq('email', email).maybeSingle();
      throwIf(error);
      if (data && data.data) return data.data;            // cloud wins
      await upsertUserRow(localUser);                      // seed cloud from local
      return localUser;
    });
  }

  async function upsertUserRow(user) {
    const email = user && user.email;
    if (!email) return;
    const row = { email, slug: emailSlug(email), name: user.name || null, data: user };
    const { error } = await supabase.from('users').upsert(row, { onConflict: 'email' });
    throwIf(error);
  }

  // Public upsert used by the landing login modal.
  function upsertUser(user) { return track(() => upsertUserRow(user)); }

  // ── Pins ─────────────────────────────────────────────────────────────────
  // Pull: cloud is source of truth. If cloud has pins, they replace local; if
  // cloud is empty, local is seeded up to cloud. Returns the resolved array, or
  // undefined when offline.
  async function pullPins(email, localPins) {
    if (!email) return undefined;
    return track(async () => {
      const { data, error } = await supabase.from('pins').select('data').eq('user_email', email);
      throwIf(error);
      const cloud = (data || []).map((r) => r.data).filter(Boolean);
      if (cloud.length) return cloud;                      // cloud wins
      if (localPins && localPins.length) await pushPinsRow(localPins, email); // seed cloud
      return localPins || [];
    });
  }

  function pushPins(pins, email) { if (!email) return Promise.resolve(); return track(() => pushPinsRow(pins, email)); }
  async function pushPinsRow(pins, email) {
    const list = pins || [];
    if (list.length) {
      const rows = list.map((p) => ({ id: p.id, user_email: email, data: p }));
      const { error } = await supabase.from('pins').upsert(rows, { onConflict: 'id' });
      throwIf(error);
    }
    await deleteMissing('pins', email, list.map((p) => p.id));
  }

  // ── Trips ────────────────────────────────────────────────────────────────
  async function pullTrips(email, localTrips) {
    if (!email) return undefined;
    return track(async () => {
      const { data, error } = await supabase.from('trips').select('data').eq('user_email', email);
      throwIf(error);
      const cloud = (data || []).map((r) => r.data).filter(Boolean);
      if (cloud.length) return cloud;
      if (localTrips && localTrips.length) await pushTripsRow(localTrips, email);
      return localTrips || [];
    });
  }

  function pushTrips(trips, email) { if (!email) return Promise.resolve(); return track(() => pushTripsRow(trips, email)); }
  async function pushTripsRow(trips, email) {
    const list = trips || [];
    if (list.length) {
      const rows = list.map((t) => ({ id: t.id, user_email: email, data: t }));
      const { error } = await supabase.from('trips').upsert(rows, { onConflict: 'id' });
      throwIf(error);
    }
    await deleteMissing('trips', email, list.map((t) => t.id));
  }

  // Delete rows for this user whose id is no longer in keepIds.
  async function deleteMissing(table, email, keepIds) {
    let q = supabase.from(table).delete().eq('user_email', email);
    if (keepIds.length) q = q.not('id', 'in', '(' + keepIds.map((id) => `"${id}"`).join(',') + ')');
    const { error } = await q;
    throwIf(error);
  }

  // ── Challenges (additive: unlocked only accrues) ───────────────────────────
  async function pullChallenges(email, localState) {
    if (!email) return undefined;
    return track(async () => {
      const { data, error } = await supabase.from('challenges').select('challenge_id, unlocked_at').eq('user_email', email);
      throwIf(error);
      const cloud = {};
      for (const r of (data || [])) cloud[r.challenge_id] = r.unlocked_at;
      // union: cloud + local; push any local-only rows up so cloud stays complete
      const localUnlocked = (localState && localState.unlocked) || {};
      const onlyLocal = Object.keys(localUnlocked).filter((id) => !(id in cloud));
      if (onlyLocal.length) {
        const rows = onlyLocal.map((id) => ({ user_email: email, challenge_id: id, unlocked_at: localUnlocked[id] }));
        const { error: upErr } = await supabase.from('challenges').upsert(rows, { onConflict: 'user_email,challenge_id' });
        throwIf(upErr);
      }
      return { ...localUnlocked, ...cloud };               // merged unlocked map
    });
  }

  function saveChallenge(email, id, unlockedAt) {
    if (!email) return Promise.resolve();
    return track(async () => {
      const { error } = await supabase.from('challenges')
        .upsert({ user_email: email, challenge_id: id, unlocked_at: unlockedAt }, { onConflict: 'user_email,challenge_id' });
      throwIf(error);
    });
  }

  // ── Shared (read-only) globe ───────────────────────────────────────────────
  // Resolve a share slug → { user, pins, trips }, or null if not found / offline.
  async function fetchSharedGlobe(slug) {
    if (!slug) return null;
    const result = await track(async () => {
      const { data: u, error: uErr } = await supabase.from('users').select('email, name, data').eq('slug', slug).maybeSingle();
      throwIf(uErr);
      if (!u) return null;
      const [{ data: pinRows, error: pErr }, { data: tripRows, error: tErr }] = await Promise.all([
        supabase.from('pins').select('data').eq('user_email', u.email),
        supabase.from('trips').select('data').eq('user_email', u.email),
      ]);
      throwIf(pErr); throwIf(tErr);
      return {
        user: u.data || { name: u.name },
        pins: (pinRows || []).map((r) => r.data).filter(Boolean),
        trips: (tripRows || []).map((r) => r.data).filter(Boolean),
      };
    });
    return result || null;
  }

  return {
    emailSlug,
    upsertUser, resolveUser,
    pullPins, pushPins,
    pullTrips, pushTrips,
    pullChallenges, saveChallenge,
    fetchSharedGlobe,
  };
}
