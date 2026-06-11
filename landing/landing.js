// Wanderglobe landing — starfield, scroll reveals, hero parallax, nav.

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

// ── CTA form (preview placeholder) ───────────────────────────────────────────
const ctaForm = document.querySelector('.cta-form');
if (ctaForm) {
  ctaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = ctaForm.querySelector('input');
    input.placeholder = 'Thanks — we\'ll be in touch!';
    input.value = '';
    input.disabled = true;
    const btn = ctaForm.querySelector('button');
    btn.textContent = "You're on the list";
    btn.disabled = true;
  });
}

// ── Smooth anchor offset for fixed nav ───────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
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
