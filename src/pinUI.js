import { createPinLayer } from './pins.js';

// Ties together: the 3D pin layer, localStorage persistence, reverse-geocoding,
// photo compression, and all the DOM panels (Add/Edit sheet, info card, the
// pin-mode button, and the live stats counter). main.js just routes pointer
// events and calls update() each frame.

const KEY = 'wanderglobe_pins';
const MAX_PHOTO_LEN = 270000; // ~200 KB once base64-encoded

const $ = (id) => document.getElementById(id);

// ── Helpers ──────────────────────────────────────────────────────────────────
function genId() {
  return 'pin_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

// Free reverse geocoding, no API key. Returns "City, Country" (best effort).
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

// Downscale + JPEG-compress an uploaded image until it fits the storage budget,
// returning a base64 data URL.
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

  // DOM
  const btnPin = $('btn-pin');
  const statsEl = $('pin-stats');
  const panel = $('pin-panel');
  const card = $('pin-card');

  const titleEl = $('pin-panel-title');
  const coordsEl = $('pin-panel-coords');
  const nameInput = $('pin-name');
  const noteInput = $('pin-note');
  const noteCount = $('pin-note-count');
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

  // State
  let store = load();
  let pinMode = false;
  let editingId = null;
  let cardId = null;
  let pendingLatLng = null;
  let currentType = 'visited';
  let currentPhoto = null;
  let geoToken = 0;

  store.forEach((p) => layer.addPin(p));
  renderStats();

  // ── Persistence ────────────────────────────────────────────────────────────
  function load() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY));
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

  function renderStats() {
    let visited = 0;
    let wishlist = 0;
    for (const p of store) (p.type === 'wishlist' ? wishlist++ : visited++);
    statsEl.innerHTML = `<b class="v">${visited}</b> visited · <b class="w">${wishlist}</b> wishlist`;
  }

  // ── Pin mode + chrome ────────────────────────────────────────────────────────
  function setPinMode(on) {
    pinMode = on;
    btnPin.classList.toggle('active', on);
    btnPin.setAttribute('aria-pressed', String(on));
    earthView.setSpin(!on); // pause the auto-spin while aiming
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
    btnPin.classList.add('visible');
    statsEl.classList.add('visible');
  }
  function hideChrome() {
    btnPin.classList.remove('visible');
    statsEl.classList.remove('visible');
    if (pinMode) setPinMode(false);
    closePanels();
  }

  // ── Add / Edit sheet ──────────────────────────────────────────────────────────
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

  // Open the Add sheet for a fresh surface point.
  function openAdd(worldPoint) {
    const { lat, lng } = layer.latLngFromWorld(worldPoint);
    editingId = null;
    pendingLatLng = { lat, lng };
    layer.setPending(lat, lng);

    resetForm();
    applyType('visited');
    titleEl.textContent = 'Add Pin';
    coordsEl.textContent = fmtCoords(lat, lng);
    nameInput.placeholder = 'Locating…';

    openSheet(panel);
    sound.click();

    const token = ++geoToken;
    reverseGeocode(lat, lng).then((name) => {
      if (token !== geoToken) return;           // a newer open superseded this
      nameInput.placeholder = 'Place name';
      if (!nameInput.value && name) nameInput.value = name;
    });
  }

  // Open the Add sheet pre-filled to edit an existing pin.
  function openEdit(id) {
    const pin = store.find((p) => p.id === id);
    if (!pin) return;
    editingId = id;
    geoToken++; // cancel any pending geocode
    pendingLatLng = { lat: pin.lat, lng: pin.lng };
    layer.clearPending();

    resetForm();
    applyType(pin.type);
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

    if (editingId) {
      const pin = store.find((p) => p.id === editingId);
      if (!pin) return;
      const prev = { ...pin };
      pin.name = name;
      pin.note = note;
      pin.type = currentType;
      pin.photoBase64 = currentPhoto || null;
      layer.updatePin(pin);
      if (!persist()) {
        Object.assign(pin, prev); // roll back
        layer.updatePin(pin);
        statusEl.textContent = 'Storage full — try a smaller photo.';
        return;
      }
    } else {
      const { lat, lng } = pendingLatLng;
      const pin = {
        id: genId(), name, lat, lng, type: currentType,
        note, photoBase64: currentPhoto || null, dateAdded: new Date().toISOString(),
      };
      store.push(pin);
      layer.addPin(pin);
      if (!persist()) {
        store.pop();
        layer.removePin(pin.id);
        statusEl.textContent = 'Storage full — try a smaller photo.';
        return;
      }
    }

    layer.clearPending();
    renderStats();
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

  // ── Info card ─────────────────────────────────────────────────────────────────
  function openCard(id) {
    const pin = store.find((p) => p.id === id);
    if (!pin) return;
    cardId = id;
    deleteConfirm.classList.remove('show');

    cardName.textContent = pin.name;
    cardBadge.textContent = pin.type === 'wishlist' ? 'Wishlist' : 'Visited';
    cardBadge.className = 'pin-badge ' + (pin.type === 'wishlist' ? 'wishlist' : 'visited');
    cardPhoto.innerHTML = pin.photoBase64 ? `<img src="${pin.photoBase64}" alt="${pin.name}" />` : '';
    cardPhoto.style.display = pin.photoBase64 ? 'block' : 'none';
    cardNote.textContent = pin.note || '';
    cardNote.style.display = pin.note ? 'block' : 'none';
    cardCoords.textContent = fmtCoords(pin.lat, pin.lng);
    cardDate.textContent = pin.dateAdded ? `Added ${fmtDate(pin.dateAdded)}` : '';

    closeSheet(panel);
    openSheet(card);
    sound.click();
  }

  function doDelete() {
    if (!cardId) return;
    layer.removePin(cardId);
    store = store.filter((p) => p.id !== cardId);
    persist();
    renderStats();
    cardId = null;
    closeSheet(card);
    sound.click();
  }

  // ── Sheet open/close ───────────────────────────────────────────────────────────
  function openSheet(el) { el.classList.add('open'); }
  function closeSheet(el) { el.classList.remove('open'); }
  function panelOpen() { return panel.classList.contains('open') || card.classList.contains('open'); }
  function closePanels() {
    closeSheet(panel);
    closeSheet(card);
    deleteConfirm.classList.remove('show');
    layer.clearPending();
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
    photoInput.value = ''; // allow re-picking the same file
  });

  $('pin-save').addEventListener('click', save);
  $('pin-cancel').addEventListener('click', cancel);
  $('pin-panel-close').addEventListener('click', cancel);
  $('pin-card-close').addEventListener('click', () => { closeSheet(card); sound.click(); });
  $('pin-edit').addEventListener('click', () => { if (cardId) openEdit(cardId); });
  $('pin-delete').addEventListener('click', () => { deleteConfirm.classList.add('show'); sound.click(); });
  $('pin-delete-no').addEventListener('click', () => { deleteConfirm.classList.remove('show'); });
  $('pin-delete-yes').addEventListener('click', doDelete);

  function pickPin(clientX, clientY) {
    return layer.pickPin(earthView.camera, clientX, clientY, window.innerWidth, window.innerHeight);
  }

  return {
    update: (dt) => layer.update(dt),
    toggleMode, isPinMode, panelOpen,
    showChrome, hideChrome, closePanels,
    pickPin, openAdd, openCard, openEdit,
  };
}
