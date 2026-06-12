// Wanderglobe landing — starfield, scroll reveals, hero parallax, nav, login.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Starfield ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');
let stars = [];
let animating = !reducedMotion;

function buildStars() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const density = reducedMotion ? 8000 : 4200;
  const count = Math.floor((canvas.width * canvas.height) / density);
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.1 + 0.15,
    s: Math.random() * 0.04 + 0.008,
    p: Math.random() * Math.PI * 2,
    depth: Math.random(),
  }));
}

function drawStars(t) {
  if (!animating) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const st of stars) {
    st.x -= st.s * (0.5 + st.depth);
    st.y += st.s * 0.2;
    if (st.x < 0) st.x = canvas.width;
    if (st.y > canvas.height) st.y = 0;

    const twinkle = 0.35 + 0.65 * Math.sin(t / (700 + st.depth * 400) + st.p);
    ctx.globalAlpha = twinkle * (0.4 + st.depth * 0.6);
    ctx.fillStyle = st.depth > 0.6 ? '#ffffff' : '#a8c4ff';
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r * (0.7 + st.depth * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  requestAnimationFrame(drawStars);
}

buildStars();
window.addEventListener('resize', buildStars);
if (animating) requestAnimationFrame(drawStars);

// ── Nav ──────────────────────────────────────────────────────────────────────
const header = document.getElementById('nav');
const navToggle = document.getElementById('nav-toggle');
const mobileMenu = document.getElementById('mobile-menu');

function onScroll() {
  header.classList.toggle('scrolled', window.scrollY > 20);
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

function closeMobileMenu() {
  navToggle.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
  mobileMenu.classList.remove('open');
  mobileMenu.setAttribute('aria-hidden', 'true');
}

navToggle.addEventListener('click', () => {
  const open = navToggle.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
  mobileMenu.classList.toggle('open', open);
  mobileMenu.setAttribute('aria-hidden', String(!open));
});

mobileMenu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeMobileMenu);
});

// ── Scroll reveal ────────────────────────────────────────────────────────────
const revealEls = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      const delay = Number(el.dataset.delay || 0);
      setTimeout(() => el.classList.add('visible'), delay);
      revealObserver.unobserve(el);
    }
  },
  { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
);

revealEls.forEach((el) => revealObserver.observe(el));

// Hero: staggered entrance on load
const heroReveals = document.querySelectorAll('#hero .reveal');
heroReveals.forEach((el, i) => {
  const delay = Number(el.dataset.delay || 0) + i * 60;
  setTimeout(() => el.classList.add('visible'), 100 + delay);
});

// Hero title words: extra stagger
if (!reducedMotion) {
  document.querySelectorAll('.hero-title .line').forEach((line, lineIdx) => {
    const words = line.querySelectorAll('.word');
    words.forEach((word, wordIdx) => {
      word.style.opacity = '0';
      word.style.transform = 'translateY(20px)';
      word.style.transition = `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${lineIdx * 120 + wordIdx * 70}ms, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${lineIdx * 120 + wordIdx * 70}ms`;
      setTimeout(() => {
        word.style.opacity = '1';
        word.style.transform = 'translateY(0)';
      }, 150 + lineIdx * 120 + wordIdx * 70);
    });
  });
}

// ── Hero parallax ────────────────────────────────────────────────────────────
const heroStage = document.getElementById('hero-stage');

if (heroStage && !reducedMotion) {
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  document.addEventListener('mousemove', (e) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    targetX = (e.clientX - cx) / cx;
    targetY = (e.clientY - cy) / cy;
  });

  function tickParallax() {
    currentX += (targetX - currentX) * 0.06;
    currentY += (targetY - currentY) * 0.06;

    const rotateY = currentX * 6;
    const rotateX = -currentY * 4;
    const translateX = currentX * 12;
    const translateY = currentY * 8;

    heroStage.style.transform = `
      perspective(1200px)
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      translateX(${translateX}px)
      translateY(${translateY}px)
    `;

    requestAnimationFrame(tickParallax);
  }

  requestAnimationFrame(tickParallax);
}

// ── Login modal ──────────────────────────────────────────────────────────────
const overlay = document.getElementById('login');
const loginClose = document.getElementById('login-close');
const panesWrap = document.getElementById('login-panes');
const panes = [
  document.getElementById('pane-email'),
  document.getElementById('pane-otp'),
  document.getElementById('pane-profile'),
];
const pbars = overlay.querySelectorAll('.pbar');
const plabel = document.getElementById('plabel');
const emailInput = document.getElementById('f-email');
const otpConfirm = document.getElementById('otp-confirm');
const otpDigits = overlay.querySelectorAll('.otp-digit');
let step = 0;
let userEmail = '';

// The saved traveller, if they've onboarded before.
function getUser() {
  try {
    return JSON.parse(localStorage.getItem('wanderglobe_user'));
  } catch {
    return null;
  }
}

function setStep(i, backwards = false) {
  step = i;
  panesWrap.classList.toggle('back', backwards);
  panes.forEach((p, idx) => p.classList.toggle('is-active', idx === i));
  pbars.forEach((b, idx) => b.classList.toggle('on', idx <= i));
  plabel.textContent = `Step ${i + 1} of 3`;
  const first = panes[i].querySelector('input');
  if (first) setTimeout(() => first.focus(), 80);
}

function openLogin() {
  overlay.classList.remove('leaving');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  otpConfirm.hidden = true;
  setStep(0);
}

function closeLogin() {
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// Every "Explore the Globe" trigger: returning users skip straight to the globe.
document.querySelectorAll('.js-open-login').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const user = getUser();
    if (user && user.name) {
      window.location.href = '/globe/';
      return;
    }
    openLogin();
  });
});

loginClose.addEventListener('click', closeLogin);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeLogin();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && overlay.classList.contains('open')) closeLogin();
});

// Back buttons on steps 2 and 3
overlay.querySelectorAll('[data-back]').forEach((btn) => {
  btn.addEventListener('click', () => setStep(step - 1, true));
});

// Step 1 → "send" the OTP (demo only: confirmation text, no real email)
panes[0].addEventListener('submit', (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    emailInput.classList.add('error');
    emailInput.focus();
    setTimeout(() => emailInput.classList.remove('error'), 1400);
    return;
  }
  userEmail = email;
  document.getElementById('otp-email').textContent = email;
  document.getElementById('otp-email-2').textContent = email;
  otpConfirm.hidden = false;
  otpDigits.forEach((d) => (d.value = ''));
  setTimeout(() => setStep(1), 1000); // let the confirmation register, then advance
});

// OTP boxes: type to advance, backspace to retreat, paste fills all six
otpDigits.forEach((digit, i) => {
  digit.addEventListener('input', () => {
    digit.value = digit.value.replace(/\D/g, '').slice(0, 1);
    if (digit.value && i < otpDigits.length - 1) otpDigits[i + 1].focus();
  });
  digit.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !digit.value && i > 0) otpDigits[i - 1].focus();
  });
  digit.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
    otpDigits.forEach((d, idx) => (d.value = text[idx] || ''));
    otpDigits[Math.min(text.length, otpDigits.length - 1)].focus();
  });
});

// Step 2 → verify (demo: any code passes)
panes[1].addEventListener('submit', (e) => {
  e.preventDefault();
  setStep(2);
});

// Step 3 → save the traveller and fly to the globe
panes[2].addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('f-name').value.trim();
  const age = document.getElementById('f-age').value;
  const dob = document.getElementById('f-dob').value;
  if (!name) {
    const el = document.getElementById('f-name');
    el.classList.add('error');
    el.focus();
    setTimeout(() => el.classList.remove('error'), 1400);
    return;
  }
  localStorage.setItem(
    'wanderglobe_user',
    JSON.stringify({ name, age: Number(age) || null, dob: dob || null, email: userEmail })
  );
  overlay.classList.add('leaving'); // smooth fade out…
  setTimeout(() => {
    window.location.href = '/globe/'; // …then into the globe
  }, 480);
});

// Returning traveller: greet them on the main CTAs
const savedUser = getUser();
if (savedUser && savedUser.name) {
  document.querySelectorAll('.js-open-login .cta-label').forEach((label) => {
    label.textContent = `Welcome back, ${savedUser.name} — Enter the Globe`;
  });
}

// ── Smooth anchor offset for fixed nav ───────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  // login triggers navigate or open the modal instead of scrolling
  if (anchor.classList.contains('js-open-login')) return;
  anchor.addEventListener('click', (e) => {
    const id = anchor.getAttribute('href');
    if (id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const offset = 100;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
  });
});
