// Wanderglobe landing — starfield, mini globe, scroll reveals, counters, nav, login.

import { initMiniGlobe } from './miniGlobe.js';
import { supabase } from '../src/supabase.js';
import { animate, stagger } from "animejs";

// ── Handle OAuth callback or existing session ─────────────────────────────────
(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    // Session found (OAuth redirect or persisted) — save user and go to globe
    const u = session.user;
    const existing = (() => { try { return JSON.parse(localStorage.getItem('wanderglobe_user')); } catch { return null; } })();
    if (!existing) {
      const prof = {
        name: u.user_metadata?.full_name || u.user_metadata?.name || (u.email || '').split('@')[0] || 'Traveller',
        email: u.email,
        avatar: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
        memberSince: String(new Date().getFullYear()),
      };
      localStorage.setItem('wanderglobe_user', JSON.stringify(prof));
    }
    window.location.replace('/globe/');
  } catch (e) {
    // ignore — proceed with normal landing
  }
})();

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Mini 3D globe in the hero ─────────────────────────────────────────────────
initMiniGlobe(document.getElementById('mini-globe-canvas'));

const heroStage = document.querySelector(".stage-globe, #hero-stage, .hero-globe");
if (heroStage && !reducedMotion) {
  document.addEventListener("mousemove", (e) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = (e.clientX - cx) / cx;
    const dy = (e.clientY - cy) / cy;
    heroStage.style.transform = "translate(" + (-dx * 10) + "px, " + (-dy * 10) + "px)";
  });
}

// ── Starfield ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');
let stars = [];
const animating = !reducedMotion;

function buildStars() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const density = reducedMotion ? 9000 : 5000;
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
    // electric-blue / gold / coral-white star mix to match the palette
    ctx.fillStyle = st.depth > 0.7 ? '#ffffff' : st.depth > 0.4 ? '#ffe9b0' : '#9fd8ff';
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

// ── Nav: glass background on scroll ───────────────────────────────────────────
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
mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMobileMenu));

// ── Scroll reveal ─────────────────────────────────────────────────────────────
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      const delay = Number(el.dataset.delay || 0);
      setTimeout(() => el.classList.add('visible'), delay);
      if (!reducedMotion && (el.classList.contains("bento-card") || el.classList.contains("step-card"))) {
        animate(el, {
          opacity: [0, 1],
          translateY: [30, 0],
          ease: "outExpo",
          duration: 600,
          delay: Number(el.dataset.delay || 0),
        });
      }
      revealObserver.unobserve(el);
    }
  },
  { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
);
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// Hero: staggered entrance on load
document.querySelectorAll('#hero .reveal').forEach((el, i) => {
  const delay = Number(el.dataset.delay || 0) + i * 60;
  setTimeout(() => el.classList.add('visible'), 100 + delay);
});

// Hero title words: extra per-word stagger
if (!reducedMotion) {
  const words = document.querySelectorAll(".hero-title .word");
  words.forEach((w) => { w.style.opacity = "0"; w.style.transform = "translateY(20px)"; });
  animate(words, {
    opacity: [0, 1],
    translateY: [20, 0],
    ease: "outExpo",
    duration: 700,
    delay: stagger(80, { start: 200 }),
  });
}

// ── Animated number counters (stats bar) ──────────────────────────────────────
const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

function format(value, decimals) {
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function runCounter(el) {
  const target = parseFloat(el.dataset.count || '0');
  const decimals = Number(el.dataset.decimals || 0);
  const suffix = el.dataset.suffix || '';
  if (reducedMotion) {
    el.textContent = format(target, decimals) + suffix;
    return;
  }
  const duration = 2000;
  const start = performance.now();
  function tick(now) {
    const k = Math.min((now - start) / duration, 1);
    el.textContent = format(target * easeOutExpo(k), decimals) + suffix;
    if (k < 1) requestAnimationFrame(tick);
    else el.textContent = format(target, decimals) + suffix;
  }
  requestAnimationFrame(tick);
}

const counterObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      if (!reducedMotion) {
        const target = parseFloat(entry.target.dataset.count || "0");
        const decimals = Number(entry.target.dataset.decimals || 0);
        const suffix = entry.target.dataset.suffix || "";
        const obj = { val: 0 };
        animate(obj, {
          val: target,
          duration: 2000,
          ease: "outExpo",
          onUpdate: () => {
            entry.target.textContent = obj.val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
          },
        });
      } else {
        runCounter(entry.target);
      }
      counterObserver.unobserve(entry.target);
    }
  },
  { threshold: 0.4 }
);
document.querySelectorAll('.stat-num').forEach((el) => counterObserver.observe(el));

// ── Login modal ───────────────────────────────────────────────────────────────
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

// Every CTA: returning users skip straight to the globe, new users see the modal.
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

overlay.querySelectorAll('[data-back]').forEach((btn) => {
  btn.addEventListener('click', () => setStep(step - 1, true));
});

// Google Sign In
document.getElementById('btn-google')?.addEventListener('click', async () => {
  try {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/globe/' },
    });
  } catch (e) {
    console.error('Google OAuth error:', e);
  }
});

// Step 1 → "send" the OTP (demo only)
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
  setTimeout(() => setStep(1), 1000);
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
  overlay.classList.add('leaving');
  setTimeout(() => {
    window.location.href = '/globe/';
  }, 480);
});

// Returning traveller: greet them on the main CTAs
const savedUser = getUser();
if (savedUser && savedUser.name) {
  document.querySelectorAll('.js-open-login .cta-label').forEach((label) => {
    label.textContent = `Welcome back, ${savedUser.name}`;
  });
}

// ── CTA float loop ────────────────────────────────────────────────────────────
if (!reducedMotion) {
  animate(".btn-glow", {
    translateY: [-3, 0],
    duration: 2500,
    ease: "inOutSine",
    alternate: true,
    loop: true,
  });
}

// ── PWA install prompt ────────────────────────────────────────────────────────
let deferredInstallPrompt = null;
const pwaBanner   = document.getElementById('pwa-banner');
const pwaInstall  = document.getElementById('pwa-install');
const pwaDismiss  = document.getElementById('pwa-dismiss');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  // Show after 30s if not already dismissed this session
  if (!sessionStorage.getItem('pwa-dismissed')) {
    setTimeout(showPwaBanner, 30000);
  }
});

function showPwaBanner() {
  if (!deferredInstallPrompt || sessionStorage.getItem('pwa-dismissed')) return;
  pwaBanner.hidden = false;
}

pwaInstall?.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') deferredInstallPrompt = null;
  pwaBanner.hidden = true;
});

pwaDismiss?.addEventListener('click', () => {
  pwaBanner.hidden = true;
  sessionStorage.setItem('pwa-dismissed', '1');
});

// ── Smooth anchor scroll with fixed-nav offset ────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  if (anchor.classList.contains('js-open-login')) return; // those open the modal
  anchor.addEventListener('click', (e) => {
    const id = anchor.getAttribute('href');
    if (id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
  });
});
