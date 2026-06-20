import * as THREE from 'three';
import { createPinLayer, localFromLatLng } from './pins.js';
import { createFlightLayer } from './flightPaths.js';
import { tween } from './tween.js';

// Ties together: the 3D pin layer, trip collections, flight-path arcs,
// localStorage persistence, reverse-geocoding, photo compression, and all the
// DOM panels (Add/Edit sheet, info card, trips panel, the tool buttons, and the
// live stats counter). main.js routes pointer events and calls update().

const KEY = 'wanderglobe_pins';
const TRIPS_KEY = 'wanderglobe_trips';
const MAX_PHOTO_LEN = 270000; // ~200 KB once base64-encoded

const $ = (id) => document.getElementById(id);

// ── Helpers ──────────────────────────────────────────────────────────────────
function genId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtCoords(lat, lng) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lng).toFixed(2)}° ${ew}`;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url);
    const j = await res.json();
    const locality = j.city || j.locality || j.principalSubdivision;
    const name = [locality, j.countryName].filter(Boolean).join(', ');
    return name || j.countryName || '';
  } catch (e) {
    return '';
  }
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      const maxDim = 1024;
      if (Math.max(w, h) > maxDim) {
        const s = maxDim / Math.max(w, h);
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const canvas = document.createElement('canvas');
      const draw = () => {
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      };
      draw();
      let q = 0.85;
      let data = canvas.toDataURL('image/jpeg', q);
      while (data.length > MAX_PHOTO_LEN && q > 0.35) {
        q -= 0.1;
        data = canvas.toDataURL('image/jpeg', q);
      }
      let guard = 0;
      while (data.length > MAX_PHOTO_LEN && guard < 5) {
        w = Math.round(w * 0.8);
        h = Math.round(h * 0.8);
        draw();
        data = canvas.toDataURL('image/jpeg', 0.7);
        guard++;
      }
      resolve(data);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function createPinManager({ earthView, sound, setHint, earthHint }) {
  const earthMesh = earthView.earth;
  const layer = createPinLayer(earthMesh);
  const flights = createFlightLayer(earthMesh);

  // DOM — pins
  const btnPin = $('btn-pin');
  const btnFlights = $('btn-flights');
  const statsEl = $('pin-stats');
  const earthTools = $('earth-tools');
  const panel = $('pin-panel');
  const card = $('pin-card');

  const titleEl = $('pin-panel-title');
  const coordsEl = $('pin-panel-coords');
  const nameInput = $('pin-name');
  const noteInput = $('pin-note');
  const noteCount = $('pin-note-count');
  const tripSelect = $('pin-trip');
  const photoInput = $('pin-photo-input');
  const photoBtn = $('pin-photo-btn');
  const photoPreview = $('pin-photo-preview');
  const statusEl = $('pin-status');
  const typeBtns = [...document.querySelectorAll('.type-opt')];

  const cardName = $('pin-card-name');
  const cardBadge = $('pin-card-badge');
  const cardPhoto = $('pin-card-photo');
  const cardNote = $('pin-card-note');
  const cardCoords = $('pin-card-coords');
  const cardDate = $('pin-card-date');
  const deleteConfirm = $('pin-delete-confirm');

  // DOM — trips
  const tripsPanel = $('trips-panel');
  const tripsList = $('trips-list');
  const tripsEmpty = $('trips-empty');
  const tripsForm = $('trips-form');
  const tripNameInput = $('trip-name');
  const tripEmojiBtns = [...document.querySelectorAll('.emoji-opt')];
  const tripColourBtns = [...document.querySelectorAll('.swatch')];

  // State
  let store = load(KEY);
  let trips = load(TRIPS_KEY);
  let pinMode = false;
  let editingId = null;
  let cardId = null;
  let pendingLatLng = null;
  let currentType = 'visited';
  let currentPhoto = null;
  let geoToken = 0;
  let selectedTripId = null;
  let newTripEmoji = '✈️';
  let newTripColour = '#ffce6a';
  let flightsOn = false;
  let changeListener = null;
  function notifyChange() { if (changeListener) changeListener(); }

  // initial render
  store.forEach((p) => layer.addPin(renderData(p)));
  renderStats();
  rebuildFlights();
  flightsOn = visitedCount() >= 3;
  flights.setVisible(flightsOn, false);
  btnFlights.classList.toggle('active', flightsOn);
  btnFlights.setAttribute('aria-pressed', String(flightsOn));

  // ── Persistence ────────────────────────────────────────────────────────────
  function load(key) {
    try {
      const a = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(a)) return a;
    } catch (e) {}
    return [];
  }
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      return false;
    }
  }
  function persistTrips() {
    try { localStorage.setItem(TRIPS_KEY, JSON.stringify(trips)); } catch (e) {}
  }

  function tripColorFor(tripId) {
    const t = trips.find((x) => x.id === tripId);
    return t ? t.colour : null;
  }
  // The object handed to the 3D layer carries a derived tripColor (never stored).
  function renderData(pin) {
    return { ...pin, tripColor: tripColorFor(pin.tripId) };
  }

  function visitedCount() {
    return store.filter((p) => p.type === 'visited').length;
  }

  function renderStats() {
    let visited = 0;
    let wishlist = 0;
    for (const p of store) (p.type === 'wishlist' ? wishlist++ : visited++);
    statsEl.innerHTML = `<b class="v">${visited}</b> visited · <b class="w">${wishlist}</b> wishlist`;
  }

  // ── Flight paths ──────────────────────────────────────────────────────────────
  function rebuildFlights() {
    flights.rebuild(store.filter((p) => p.type === 'visited').map((p) => ({ lat: p.lat, lng: p.lng })));
  }
  function toggleFlights() {
    flightsOn = !flightsOn;
    flights.setVisible(flightsOn, true);
    btnFlights.classList.toggle('active', flightsOn);
    btnFlights.setAttribute('aria-pressed', String(flightsOn));
  }

  // ── Pin mode + chrome ────────────────────────────────────────────────────────
  function setPinMode(on) {
    pinMode = on;
    btnPin.classList.toggle('active', on);
    btnPin.setAttribute('aria-pressed', String(on));
    earthView.setSpin(!on);
    earthView.canvas.style.cursor = on ? 'crosshair' : '';
    setHint(on ? 'Tap anywhere on Earth to drop a pin' : earthHint);
  }
  function toggleMode() {
    if (panelOpen()) closePanels();
    setPinMode(!pinMode);
  }
  function isPinMode() {
    return pinMode;
  }

  function showChrome() {
    earthTools.classList.add('visible');
    statsEl.classList.add('visible');
    document.getElementById('city-search')?.classList.add('visible');
  }
  function hideChrome() {
    earthTools.classList.remove('visible');
    statsEl.classList.remove('visible');
    document.getElementById('city-search')?.classList.remove('visible');
    if (pinMode) setPinMode(false);
    closePanels();
  }

  // ── Add / Edit sheet ──────────────────────────────────────────────────────────
  function populateTripSelect(selectedId) {
    tripSelect.innerHTML = '<option value="">None</option>' +
      trips.map((t) => `<option value="${t.id}">${t.emoji} ${escapeHtml(t.name)}</option>`).join('');
    tripSelect.value = selectedId || '';
  }

  function resetForm() {
    statusEl.textContent = '';
    nameInput.value = '';
    noteInput.value = '';
    noteCount.textContent = '0';
    currentPhoto = null;
    renderPhotoPreview();
    deleteConfirm.classList.remove('show');
  }

  function applyType(type) {
    currentType = type;
    typeBtns.forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  }

  function renderPhotoPreview() {
    if (currentPhoto) {
      photoPreview.innerHTML = `<img src="${currentPhoto}" alt="pin photo" /><button type="button" id="pin-photo-remove" aria-label="Remove photo">×</button>`;
      $('pin-photo-remove').addEventListener('click', () => {
        currentPhoto = null;
        renderPhotoPreview();
        photoBtn.textContent = 'Choose photo…';
      });
      photoBtn.textContent = 'Change photo…';
    } else {
      photoPreview.innerHTML = '';
      photoBtn.textContent = 'Choose photo…';
    }
  }

  function openAdd(worldPoint) {
    const { lat, lng } = layer.latLngFromWorld(worldPoint);
    editingId = null;
    pendingLatLng = { lat, lng };
    layer.setPending(lat, lng);

    resetForm();
    applyType('visited');
    populateTripSelect('');
    titleEl.textContent = 'Add Pin';
    coordsEl.textContent = fmtCoords(lat, lng);
    nameInput.placeholder = 'Locating…';

    openSheet(panel);
    sound.click();

    const token = ++geoToken;
    reverseGeocode(lat, lng).then((name) => {
      if (token !== geoToken) return;
      nameInput.placeholder = 'Place name';
      if (!nameInput.value && name) nameInput.value = name;
    });
  }

  function openEdit(id) {
    const pin = store.find((p) => p.id === id);
    if (!pin) return;
    editingId = id;
    geoToken++;
    pendingLatLng = { lat: pin.lat, lng: pin.lng };
    layer.clearPending();

    resetForm();
    applyType(pin.type);
    populateTripSelect(pin.tripId || '');
    titleEl.textContent = 'Edit Pin';
    coordsEl.textContent = fmtCoords(pin.lat, pin.lng);
    nameInput.placeholder = 'Place name';
    nameInput.value = pin.name || '';
    noteInput.value = pin.note || '';
    noteCount.textContent = String((pin.note || '').length);
    currentPhoto = pin.photoBase64 || null;
    renderPhotoPreview();

    closeSheet(card);
    openSheet(panel);
    sound.click();
  }

  function save() {
    const name = nameInput.value.trim() || 'Untitled place';
    const note = noteInput.value.trim().slice(0, 100);
    const tripId = tripSelect.value || null;

    if (editingId) {
      const pin = store.find((p) => p.id === editingId);
      if (!pin) return;
      const prev = { ...pin };
      pin.name = name;
      pin.note = note;
      pin.type = currentType;
      pin.tripId = tripId;
      pin.photoBase64 = currentPhoto || null;
      layer.updatePin(renderData(pin));
      if (!persist()) {
        Object.assign(pin, prev);
        layer.updatePin(renderData(pin));
        statusEl.textContent = 'Storage full — try a smaller photo.';
        return;
      }
    } else {
      const { lat, lng } = pendingLatLng;
      const pin = {
        id: genId('pin_'), name, lat, lng, type: currentType, tripId,
        note, photoBase64: currentPhoto || null, dateAdded: new Date().toISOString(),
      };
      store.push(pin);
      layer.addPin(renderData(pin));
      if (!persist()) {
        store.pop();
        layer.removePin(pin.id);
        statusEl.textContent = 'Storage full — try a smaller photo.';
        return;
      }
    }

    layer.clearPending();
    renderStats();
    rebuildFlights();
    notifyChange();
    if (selectedTripId) layer.setHighlight(selectedTripId);
    if (tripsPanel.classList.contains('open')) renderTripsList();
    closeSheet(panel);
    editingId = null;
    sound.chime();
  }

  function cancel() {
    layer.clearPending();
    closeSheet(panel);
    editingId = null;
    sound.click();
  }

  // Programmatically drop a Wishlist pin (used by AI suggestions, Surprise Me,
  // and the trip suggester). Returns true on success, false if storage is full.
  function addWishlistPin(lat, lng, name) {
    const pin = {
      id: genId('pin_'), name: name || 'Wishlist place', lat, lng,
      type: 'wishlist', tripId: null, note: '', photoBase64: null,
      dateAdded: new Date().toISOString(),
    };
    store.push(pin);
    layer.addPin(renderData(pin));
    if (!persist()) {
      store.pop();
      layer.removePin(pin.id);
      return false;
    }
    renderStats();
    rebuildFlights();
    notifyChange();
    sound.chime();
    return true;
  }

  // Open the Add-Pin panel at a known lat/lng with a pre-filled name.
  // Used by city search so Nominatim already handled geocoding.
  function openAddAtLatLng(lat, lng, suggestedName) {
    editingId = null;
    pendingLatLng = { lat, lng };
    layer.setPending(lat, lng);
    resetForm();
    applyType('visited');
    populateTripSelect('');
    titleEl.textContent = 'Add Pin';
    coordsEl.textContent = fmtCoords(lat, lng);
    nameInput.placeholder = 'Place name';
    if (suggestedName) nameInput.value = suggestedName;
    geoToken++; // cancel any in-flight geocode
    openSheet(panel);
    sound.click();
  }

  // Replace the entire pin + trip store (called by cloud sync on initial load).
  // Supabase wins: overwrites localStorage and refreshes the 3D layer in-place.
  function replaceStore(newPins, newTrips) {
    for (const p of store) layer.removePin(p.id);
    if (Array.isArray(newTrips)) trips = newTrips;
    if (Array.isArray(newPins))  store = newPins;
    for (const p of store) layer.addPin(renderData(p));
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
    try { localStorage.setItem(TRIPS_KEY, JSON.stringify(trips)); } catch (e) {}
    renderStats();
    rebuildFlights();
    notifyChange();
  }

  // Load another user's pins in read-only mode (shared globe viewer).
  // Clears the normal store/chrome so editing is not possible.
  function loadSharedPins(sharedPins, sharedTrips) {
    for (const p of store) layer.removePin(p.id);
    store = [];
    trips = sharedTrips || [];
    for (const p of (sharedPins || [])) layer.addPin(renderData(p));
    hideChrome();
    renderStats();
  }

  // ── Info card ─────────────────────────────────────────────────────────────────
  function openCard(id) {
    const pin = store.find((p) => p.id === id);
    if (!pin) return;
    cardId = id;
    deleteConfirm.classList.remove('show');

    cardName.textContent = pin.name;
    cardBadge.textContent = pin.type === 'wishlist' ? 'Wishlist' : 'Visited';
    cardBadge.className = 'pin-badge ' + (pin.type === 'wishlist' ? 'wishlist' : 'visited');
    cardPhoto.innerHTML = pin.photoBase64 ? `<img src="${pin.photoBase64}" alt="${escapeHtml(pin.name)}" />` : '';
    cardPhoto.style.display = pin.photoBase64 ? 'block' : 'none';
    cardNote.textContent = pin.note || '';
    cardNote.style.display = pin.note ? 'block' : 'none';
    cardCoords.textContent = fmtCoords(pin.lat, pin.lng);
    const trip = trips.find((t) => t.id === pin.tripId);
    cardDate.textContent = (pin.dateAdded ? `Added ${fmtDate(pin.dateAdded)}` : '') + (trip ? `  ·  ${trip.emoji} ${trip.name}` : '');

    closeSheet(panel);
    closeSheet(tripsPanel);
    openSheet(card);
    sound.click();
  }

  function doDelete() {
    if (!cardId) return;
    layer.removePin(cardId);
    store = store.filter((p) => p.id !== cardId);
    persist();
    renderStats();
    rebuildFlights();
    notifyChange();
    cardId = null;
    closeSheet(card);
    sound.click();
  }

  // ── Trips ─────────────────────────────────────────────────────────────────────
  function openTrips() {
    if (tripsPanel.classList.contains('open')) { closeSheet(tripsPanel); clearHighlight(); return; }
    closeSheet(panel);
    closeSheet(card);
    tripsForm.hidden = true;
    renderTripsList();
    openSheet(tripsPanel);
    sound.click();
  }

  function renderTripsList() {
    tripsList.innerHTML = '';
    tripsEmpty.style.display = trips.length ? 'none' : 'block';
    for (const t of trips) {
      const ps = store.filter((p) => p.tripId === t.id);
      const dates = ps.map((p) => p.dateAdded).filter(Boolean).sort();
      const range = dates.length ? `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}` : 'No pins yet';
      let thumbs = '';
      ps.slice(0, 4).forEach((p) => {
        thumbs += p.photoBase64
          ? `<span class="trip-thumb" style="background-image:url('${p.photoBase64}')"></span>`
          : `<span class="trip-thumb initials">${escapeHtml((p.name || '?').slice(0, 2).toUpperCase())}</span>`;
      });
      const el = document.createElement('div');
      el.className = 'trip-card' + (selectedTripId === t.id ? ' selected' : '');
      el.style.setProperty('--tc', t.colour);
      el.innerHTML =
        `<button class="trip-del" data-id="${t.id}" aria-label="Delete trip">×</button>` +
        `<div class="trip-head"><span class="trip-emoji-badge">${t.emoji}</span><span class="trip-name">${escapeHtml(t.name)}</span></div>` +
        `<div class="trip-meta">${ps.length} pin${ps.length === 1 ? '' : 's'} · ${range}</div>` +
        `<div class="trip-thumbs">${thumbs}</div>`;
      el.addEventListener('click', (e) => {
        if (e.target.closest('.trip-del')) return;
        selectTrip(t.id);
      });
      tripsList.appendChild(el);
    }
    tripsList.querySelectorAll('.trip-del').forEach((b) =>
      b.addEventListener('click', () => deleteTrip(b.dataset.id)));
  }

  function clearHighlight() {
    selectedTripId = null;
    layer.setHighlight(null);
  }

  function selectTrip(id) {
    if (selectedTripId === id) {
      clearHighlight();
    } else {
      selectedTripId = id;
      layer.setHighlight(id);
      const trip = trips.find((t) => t.id === id);
      if (trip) flyToTrip(trip);
    }
    renderTripsList();
    sound.click();
  }

  function deleteTrip(id) {
    trips = trips.filter((t) => t.id !== id);
    let touched = false;
    for (const p of store) {
      if (p.tripId === id) { p.tripId = null; layer.updatePin(renderData(p)); touched = true; }
    }
    if (touched) persist();
    persistTrips();
    if (selectedTripId === id) clearHighlight();
    renderTripsList();
    sound.click();
  }

  function createTrip() {
    const name = tripNameInput.value.trim();
    if (!name) { tripNameInput.classList.add('error'); setTimeout(() => tripNameInput.classList.remove('error'), 1200); return; }
    trips.push({ id: genId('trip_'), name, emoji: newTripEmoji, colour: newTripColour, createdAt: new Date().toISOString() });
    persistTrips();
    tripsForm.hidden = true;
    tripNameInput.value = '';
    renderTripsList();
    notifyChange(); // lets the challenge system re-check "Planner"
    sound.chime();
  }

  // Spin the globe so the trip's pins face the camera (auto-spin pauses, then resumes).
  function flyToTrip(trip) {
    const ps = store.filter((p) => p.tripId === trip.id);
    if (!ps.length) return;
    const local = new THREE.Vector3();
    for (const p of ps) local.add(localFromLatLng(p.lat, p.lng, 1));
    if (local.lengthSq() < 1e-6) return;
    local.normalize();
    const localAngle = Math.atan2(local.x, local.z);
    const camDir = earthView.camera.position.clone().normalize();
    const camAngle = Math.atan2(camDir.x, camDir.z);
    const cur = earthMesh.rotation.y;
    const delta = Math.atan2(Math.sin(camAngle - localAngle - cur), Math.cos(camAngle - localAngle - cur));
    earthView.setSpin(false);
    tween({
      duration: 1100,
      onUpdate: (k) => { earthMesh.rotation.y = cur + delta * k; },
      onComplete: () => earthView.setSpin(true),
    });
  }

  // ── Sheet open/close ───────────────────────────────────────────────────────────
  function openSheet(el) { el.classList.add('open'); }
  function closeSheet(el) { el.classList.remove('open'); }
  function panelOpen() {
    return panel.classList.contains('open') || card.classList.contains('open') || tripsPanel.classList.contains('open');
  }
  function closePanels() {
    closeSheet(panel);
    closeSheet(card);
    closeSheet(tripsPanel);
    deleteConfirm.classList.remove('show');
    tripsForm.hidden = true;
    layer.clearPending();
    clearHighlight();
    editingId = null;
    cardId = null;
  }

  // ── Wire up the controls ────────────────────────────────────────────────────────
  noteInput.addEventListener('input', () => { noteCount.textContent = String(noteInput.value.length); });
  typeBtns.forEach((b) => b.addEventListener('click', () => { applyType(b.dataset.type); sound.click(); }));
  photoBtn.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    if (!file) return;
    photoBtn.textContent = 'Compressing…';
    try {
      currentPhoto = await compressImage(file);
      renderPhotoPreview();
    } catch (e) {
      currentPhoto = null;
      statusEl.textContent = "Couldn't read that image.";
      renderPhotoPreview();
    }
    photoInput.value = '';
  });

  $('pin-save').addEventListener('click', save);
  $('pin-cancel').addEventListener('click', cancel);
  $('pin-panel-close').addEventListener('click', cancel);
  $('pin-card-close').addEventListener('click', () => { closeSheet(card); sound.click(); });
  $('pin-edit').addEventListener('click', () => { if (cardId) openEdit(cardId); });
  $('pin-delete').addEventListener('click', () => { deleteConfirm.classList.add('show'); sound.click(); });
  $('pin-delete-no').addEventListener('click', () => { deleteConfirm.classList.remove('show'); });
  $('pin-delete-yes').addEventListener('click', doDelete);

  // trips panel controls
  $('trips-close').addEventListener('click', () => { closeSheet(tripsPanel); clearHighlight(); sound.click(); });
  $('trips-new').addEventListener('click', () => { tripsForm.hidden = !tripsForm.hidden; if (!tripsForm.hidden) tripNameInput.focus(); });
  $('trip-cancel').addEventListener('click', () => { tripsForm.hidden = true; });
  tripsForm.addEventListener('submit', (e) => { e.preventDefault(); createTrip(); });
  tripEmojiBtns.forEach((b) => b.addEventListener('click', () => {
    newTripEmoji = b.dataset.emoji;
    tripEmojiBtns.forEach((x) => x.classList.toggle('active', x === b));
  }));
  tripColourBtns.forEach((b) => b.addEventListener('click', () => {
    newTripColour = b.dataset.colour;
    tripColourBtns.forEach((x) => x.classList.toggle('active', x === b));
  }));

  function pickPin(clientX, clientY) {
    return layer.pickPin(earthView.camera, clientX, clientY, window.innerWidth, window.innerHeight);
  }

  return {
    update: (dt) => { layer.update(dt); flights.update(dt); },
    toggleMode, isPinMode, panelOpen,
    showChrome, hideChrome, closePanels,
    pickPin, openAdd, openCard, openEdit, addWishlistPin,
    openAddAtLatLng, replaceStore, loadSharedPins,
    toggleFlights, openTrips, setOnChange: (fn) => { changeListener = fn; },
    getPins: () => store,
    getTrips: () => trips,
    getCounts: () => {
      let visited = 0; let wishlist = 0;
      for (const p of store) (p.type === 'wishlist' ? wishlist++ : visited++);
      return { visited, wishlist, trips: trips.length };
    },
  };
}
