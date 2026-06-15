// Profile system — a glassmorphism side panel + a top-right avatar button.
// Reads name/email/dob from wanderglobe_user and adds bio, avatar, hometown,
// and member-since, persisting them back into the same localStorage record.

const KEY = 'wanderglobe_user';
const $ = (id) => document.getElementById(id);

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (e) {
    return {};
  }
}
function saveUser(u) {
  try { localStorage.setItem(KEY, JSON.stringify(u)); } catch (e) {}
}

function initials(name) {
  if (!name) return '🌍';
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function slug(name) {
  return (name || 'traveller').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'traveller';
}

// Same downscale+compress approach used for pin photos.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      const max = 512; // avatars are small
      if (Math.max(w, h) > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      let q = 0.85;
      let data = canvas.toDataURL('image/jpeg', q);
      while (data.length > 150000 && q > 0.4) { q -= 0.1; data = canvas.toDataURL('image/jpeg', q); }
      resolve(data);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function createProfile({ getCounts }) {
  const panel = $('profile-panel');
  const btn = $('btn-profile');
  const avatarSmall = $('profile-avatar');
  const avatarLg = $('profile-avatar-lg');
  const nameEl = $('profile-name');
  const hometownEl = $('profile-hometown');
  const bioEl = $('profile-bio');
  const sinceEl = $('profile-since');
  const quickEl = $('profile-quickstats');
  const linkEl = $('profile-public-link');

  const form = $('profile-form');
  const avatarInput = $('profile-avatar-input');
  const avatarBtn = $('profile-avatar-btn');
  const avatarPreview = $('profile-avatar-preview');
  const hometownInput = $('profile-hometown-input');
  const bioInput = $('profile-bio-input');
  const bioCount = $('profile-bio-count');

  let open = false;
  let editAvatar = null; // pending avatar during edit

  function avatarMarkup(user, size) {
    if (user.avatar) return `<img src="${user.avatar}" alt="avatar" />`;
    const grad = `linear-gradient(135deg, #4fc3f7, #ff6b8a)`;
    return `<span class="avatar-initials" style="background:${grad}">${initials(user.name)}</span>`;
  }

  // The little avatar that lives in the globe's top-right tool cluster.
  function renderAvatarButton() {
    const user = loadUser();
    avatarSmall.innerHTML = user.avatar
      ? `<img src="${user.avatar}" alt="profile" />`
      : `<span class="avatar-initials sm">${initials(user.name)}</span>`;
  }

  function render() {
    const user = loadUser();
    avatarLg.innerHTML = avatarMarkup(user);
    nameEl.textContent = user.name || 'Traveller';
    hometownEl.textContent = user.hometown || '';
    hometownEl.style.display = user.hometown ? 'block' : 'none';
    bioEl.textContent = user.bio || '';
    bioEl.style.display = user.bio ? 'block' : 'none';
    sinceEl.textContent = `Member since ${user.memberSince || '2026'}`;
    const c = getCounts();
    quickEl.innerHTML =
      `<span><b>${c.visited}</b> visited</span><span class="dot"></span>` +
      `<span><b>${c.wishlist}</b> wishlist</span><span class="dot"></span>` +
      `<span><b>${c.trips}</b> trips</span>`;
    linkEl.textContent = `earth-simulator-two.vercel.app/globe?user=${slug(user.name)}`;
  }

  function openPanel() {
    closeForm();
    render();
    panel.classList.add('open');
    open = true;
  }
  function close() {
    panel.classList.remove('open');
    open = false;
  }

  function renderAvatarPreview() {
    const user = loadUser();
    const src = editAvatar !== null ? editAvatar : user.avatar;
    if (src) {
      avatarPreview.innerHTML = `<img src="${src}" alt="avatar" /><button type="button" id="profile-avatar-remove" aria-label="Remove">×</button>`;
      $('profile-avatar-remove').addEventListener('click', () => { editAvatar = ''; renderAvatarPreview(); });
      avatarBtn.textContent = 'Change photo…';
    } else {
      avatarPreview.innerHTML = '';
      avatarBtn.textContent = 'Choose photo…';
    }
  }

  function openForm() {
    const user = loadUser();
    editAvatar = null;
    hometownInput.value = user.hometown || '';
    bioInput.value = user.bio || '';
    bioCount.textContent = String((user.bio || '').length);
    renderAvatarPreview();
    form.hidden = false;
  }
  function closeForm() {
    form.hidden = true;
    editAvatar = null;
  }

  function save() {
    const user = loadUser();
    user.hometown = hometownInput.value.trim();
    user.bio = bioInput.value.trim().slice(0, 120);
    if (editAvatar !== null) user.avatar = editAvatar || null;
    if (!user.memberSince) user.memberSince = String(new Date().getFullYear());
    saveUser(user);
    closeForm();
    render();
    renderAvatarButton();
  }

  // wire
  btn.addEventListener('click', openPanel);
  $('profile-close').addEventListener('click', close);
  $('profile-edit').addEventListener('click', openForm);
  $('profile-cancel').addEventListener('click', closeForm);
  $('profile-save').addEventListener('click', save);
  avatarBtn.addEventListener('click', () => avatarInput.click());
  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files[0];
    if (!file) return;
    avatarBtn.textContent = 'Compressing…';
    try { editAvatar = await compressImage(file); } catch (e) { editAvatar = null; }
    renderAvatarPreview();
    avatarInput.value = '';
  });
  bioInput.addEventListener('input', () => { bioCount.textContent = String(bioInput.value.length); });

  renderAvatarButton();

  return { open: openPanel, close, isOpen: () => open, refresh: () => { renderAvatarButton(); if (open) render(); } };
}
