import * as THREE from 'three';
import { createEarthView } from './earthView.js';
import { createSolarView } from './solarView.js';
import { createInfoPanel } from './infoPanel.js';
import { createPinManager } from './pinUI.js';
import { latLngFromLocal, localFromLatLng } from './pins.js';
import { createStatsOverlay } from './stats.js';
import { createProfile } from './profile.js';
import { createTripPlanner } from './tripPlanner.js';
import { createVisaChecker } from './visa.js';
import { createChallenges } from './challenges.js';
import { createSurprise } from './surprise.js';
import { createAISuggester } from './aiSuggest.js';
import { createYearReview } from './yearReview.js';
import { createWeatherLayer } from './weatherLayer.js';
import { createAurora } from './aurora.js';
import { createTerminator } from './terminator.js';
import { createSeismicLayer } from './seismic.js';
import { createCountryLayer } from './countries.js';
import { createCinematic } from './cinematic.js';
import { getSunDirection } from './sun.js';
import { tween, updateTweens } from './tween.js';
import { SoundManager } from './sound.js';
import { createCloudSync, emailSlug } from './cloudSync.js';
import { supabase } from './supabase.js';
import { createCitySearch } from './citySearch.js';
import { createLiveFlights } from './liveFlights.js';
import { createISSTracker } from './iss.js';
import { createTimeZoneLayer } from './timeZones.js';
import { createSeismicTimeline } from './seismicTimeline.js';
import { createCountryFacts } from './countryFacts.js';
import { createWeatherPins } from './weatherPins.js';
import { createPopulationLayer } from './population.js';
import { createTravelHeatmap } from './travelHeatmap.js';
import { createAmbientMusic } from './ambientMusic.js';
import { createScreenshotMode } from './screenshotMode.js';

// ── Renderer (shared by both views) ──────────────────────────────────────────
// logarithmicDepthBuffer lets one camera handle both the 1-unit Earth and the
// 1000s-of-units solar system without z-fighting.
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,            // smooth edges
  logarithmicDepthBuffer: true,
  precision: 'highp',         // full float precision in shaders (avoids cracking/banding)
});
// Cap the pixel ratio at 2 — on high-DPI phones a ratio of 3 triples the pixels
// to shade for no visible gain, so this keeps mobile smooth.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// Sharpest texture filtering the GPU supports — shared by both views so the
// planet surfaces stay crisp at grazing angles instead of blocky/seamed.
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

// Tracks texture loading so the loading screen can show real progress.
const loadingManager = new THREE.LoadingManager();

// ── The two views ────────────────────────────────────────────────────────────
const earthView = createEarthView(canvas, maxAnisotropy, loadingManager);
const solarView = createSolarView(canvas, maxAnisotropy, loadingManager);
const infoPanel = createInfoPanel();

// ── Overlay DOM ──────────────────────────────────────────────────────────────
const fadeEl = document.getElementById('fade');
const btnBack = document.getElementById('btn-back');
const btnEarth = document.getElementById('btn-earth');
const btnSound = document.getElementById('btn-sound');
const btnPin = document.getElementById('btn-pin');
const hintEl = document.getElementById('hint');

// The idle hint shown on the close-up Earth view.
const EARTH_HINT = 'Drop pins on Earth · zoom out to explore the solar system';

// ── Sound ────────────────────────────────────────────────────────────────────
// All audio is synthesised live (see sound.js). It can't start until the user
// interacts (browser autoplay policy), so we unlock it on the first gesture.
const sound = new SoundManager();
sound.setAmbient('earth'); // queued; begins once unlocked
btnSound.classList.toggle('muted', !sound.isEnabled());
btnSound.setAttribute('aria-pressed', String(sound.isEnabled()));

function unlockAudio() {
  sound.unlock();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

btnSound.addEventListener('click', () => {
  sound.unlock(); // the toggle itself is a valid first gesture
  const on = sound.toggle();
  btnSound.classList.toggle('muted', !on);
  btnSound.setAttribute('aria-pressed', String(on));
});

// ── Cloud sync (Supabase) ─────────────────────────────────────────────────────
const cloudSync = createCloudSync();

function getCurrentUserEmail() {
  try { const u = JSON.parse(localStorage.getItem('wanderglobe_user')); return (u && u.email) ? u.email : null; }
  catch (e) { return null; }
}

// ── Travel pins, trips, flight paths, stats, profile (Earth close-up view) ────
const pins = createPinManager({ earthView, sound, setHint, earthHint: EARTH_HINT });
let countries = null; // the country-fill layer (created below); stats reads its live count
const stats = createStatsOverlay({
  getPins: pins.getPins,
  getTrips: pins.getTrips,
  getCountryCount: () => (countries ? countries.visitedCountryCount() : null),
});
const profile = createProfile({
  getCounts: pins.getCounts,
  onSave: (user) => { if (user && user.email) cloudSync.upsertUser(user); },
  getShareUrl: () => {
    const email = getCurrentUserEmail();
    return email ? `https://earth-simulator-two.vercel.app/globe?share=${emailSlug(email)}` : '';
  },
});

btnPin.addEventListener('click', () => { sound.click(); pins.toggleMode(); });
document.getElementById('btn-flights').addEventListener('click', () => { sound.click(); pins.toggleFlights(); });
document.getElementById('btn-trips').addEventListener('click', () => { sound.click(); pins.openTrips(); });
document.getElementById('btn-stats').addEventListener('click', () => { sound.click(); stats.open(); });
// (the profile avatar button wires itself up inside profile.js)

// ── Live weather overlay (RainViewer radar tiles) ────────────────────────────
// Wraps the Earth in real precipitation/cloud data; the badge pulses when fresh.
// Falls back silently to the static cloud layer if the API/tiles are unavailable.
const weatherBadge = document.getElementById('weather-badge');
let weatherReady = false;
const weather = createWeatherLayer(earthView.earth, () => {
  weatherReady = true;
  if (mode === 'earth') weatherBadge.classList.add('show', 'fresh');
});

// ── Map layers: aurora, terminator, seismic, countries ───────────────────────
const aurora = createAurora(earthView.scene);
const terminator = createTerminator(earthView.scene); // on by default
const seismic = createSeismicLayer(earthView.earth);
countries = createCountryLayer(earthView.earth, { getPins: pins.getPins });

let auroraOn = false;
let seismicOn = false;
let countriesOn = false;
let terminatorOn = true;
let seismicLoaded = false;
let countriesReadyFlag = false;

const seismicLive = document.getElementById('seismic-live');
seismic.onFresh(() => { seismicLoaded = true; seismicLive.classList.add('show'); });
countries.onReady(() => {
  countriesReadyFlag = true;
  if (countriesOn) { countries.rebuild(); countries.setVisible(true, true); }
});
// Fan a single pin-change event out to every interested subsystem (country
// fills, challenge checks, trip-planner waypoints — registered as they're built).
const pinChangeHooks = [() => { if (countriesReadyFlag && countriesOn) countries.rebuild(); }];
pins.setOnChange(() => {
  for (const fn of pinChangeHooks) { try { fn(); } catch (e) {} }
  // Push the updated store to Supabase after every mutation.
  const email = getCurrentUserEmail();
  if (email) {
    cloudSync.pushPins(pins.getPins(), email);
    cloudSync.pushTrips(pins.getTrips(), email);
  }
});

// ── Layers popover + toggle switches ─────────────────────────────────────────
const btnLayers = document.getElementById('btn-layers');
const layersPanel = document.getElementById('layers-panel');
const swAurora = document.getElementById('sw-aurora');
const swSeismic = document.getElementById('sw-seismic');
const swCountries = document.getElementById('sw-countries');
const swTerminator = document.getElementById('sw-terminator');

function setSwitch(el, on) { el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on)); }

btnLayers.addEventListener('click', () => {
  sound.click();
  const open = layersPanel.classList.toggle('open');
  layersPanel.setAttribute('aria-hidden', String(!open));
  btnLayers.classList.toggle('active', open);
});
swAurora.addEventListener('click', () => { sound.click(); auroraOn = !auroraOn; aurora.setVisible(auroraOn); setSwitch(swAurora, auroraOn); });
swTerminator.addEventListener('click', () => { sound.click(); terminatorOn = !terminatorOn; terminator.setVisible(terminatorOn); setSwitch(swTerminator, terminatorOn); });
swSeismic.addEventListener('click', () => {
  sound.click();
  seismicOn = !seismicOn;
  seismic.setVisible(seismicOn);
  setSwitch(swSeismic, seismicOn);
  if (seismicOn) seismic.refresh(); // fetch on first/each enable
});
swCountries.addEventListener('click', () => {
  sound.click();
  countriesOn = !countriesOn;
  setSwitch(swCountries, countriesOn);
  if (countriesOn) {
    if (countriesReadyFlag) { countries.rebuild(); countries.setVisible(true, true); }
    else countries.rebuild(); // kicks the one-time geojson fetch; onReady reveals it
  } else {
    countries.setVisible(false);
  }
});

// refresh quakes every 5 minutes while the seismic layer is on
setInterval(() => { if (seismicOn) seismic.refresh(); }, 5 * 60 * 1000);

// ── New feature layers ────────────────────────────────────────────────────────
// visa must be available for countryFacts — create it here (mountSelector called later)
const visa = createVisaChecker({ sound });

// Hard safety timeout registered BEFORE any module init so it fires even if one crashes.
// revealGlobe is a hoisted function; loaderEl/loaderFill/ready are all initialised
// synchronously before 10 s elapses.
setTimeout(revealGlobe, 10000); // eslint-disable-line no-use-before-define

const _noop = () => {};

const liveFlights = (() => {
  try { return createLiveFlights(earthView.earth); }
  catch (e) { console.error('[WG] liveFlights failed:', e); return { setVisible: _noop, refresh: _noop, onCountChange: _noop, getClickables: () => [], getFlightData: () => null }; }
})();

const issTracker = (() => {
  try { return createISSTracker(earthView.earth); }
  catch (e) { console.error('[WG] issTracker failed:', e); return { update: _noop, getClickable: () => null, getInfo: () => null }; }
})();

const timeZones = (() => {
  try { return createTimeZoneLayer(earthView.earth); }
  catch (e) { console.error('[WG] timeZones failed:', e); return { setVisible: _noop }; }
})();

const seismicTimeline = (() => {
  try { return createSeismicTimeline(seismic, earthView.earth); }
  catch (e) { console.error('[WG] seismicTimeline failed:', e); return { show: _noop, hide: _noop }; }
})();

const countryFacts = (() => {
  try { return createCountryFacts({ visa, pins, flyTo: flyToLatLng, sound }); }
  catch (e) { console.error('[WG] countryFacts failed:', e); return { show: _noop }; }
})();

const weatherPins = (() => {
  try { return createWeatherPins(earthView.earth, { getPins: pins.getPins }); }
  catch (e) { console.error('[WG] weatherPins failed:', e); return { setVisible: _noop, rebuild: _noop, cardHtml: () => '' }; }
})();

const population = (() => {
  try { return createPopulationLayer(earthView.earth); }
  catch (e) { console.error('[WG] population failed:', e); return { setVisible: _noop }; }
})();

const travelHeatmap = (() => {
  try { return createTravelHeatmap(earthView.earth, { getPins: pins.getPins }); }
  catch (e) { console.error('[WG] travelHeatmap failed:', e); return { setVisible: _noop, rebuild: _noop }; }
})();

const ambientMusic = (() => {
  try { return createAmbientMusic(sound); }
  catch (e) { console.error('[WG] ambientMusic failed:', e); return { update: _noop, stop: _noop, dispose: _noop }; }
})();

const screenshotMode = (() => {
  try { return createScreenshotMode({ renderer, getScene: () => earthView.scene, getCamera: () => earthView.camera }); }
  catch (e) { console.error('[WG] screenshotMode failed:', e); return { capture: _noop, toggleClean: _noop, isClean: () => false }; }
})();

// Layer switches for new features
const swFlights    = document.getElementById('sw-flights');
const swTimezones  = document.getElementById('sw-timezones');
const swWeatherPins = document.getElementById('sw-weatherpins');
const swPopulation = document.getElementById('sw-population');
const swHeatmap    = document.getElementById('sw-heatmap');
const flightsLive  = document.getElementById('flights-live');
const flightsCount = document.querySelector('.flights-count');

let flightsOn = false, timezonesOn = false, weatherPinsOn = false, populationOn = false, heatmapOn = false;

liveFlights.onCountChange((n) => {
  if (flightsLive) flightsLive.style.display = n > 0 ? '' : 'none';
  if (flightsCount) flightsCount.textContent = n > 0 ? `${n.toLocaleString()} flights` : '';
});

swFlights?.addEventListener('click', () => {
  sound.click(); flightsOn = !flightsOn;
  liveFlights.setVisible(flightsOn); setSwitch(swFlights, flightsOn);
  if (flightsOn) liveFlights.refresh();
});
swTimezones?.addEventListener('click', () => {
  sound.click(); timezonesOn = !timezonesOn;
  timeZones.setVisible(timezonesOn); setSwitch(swTimezones, timezonesOn);
});
swWeatherPins?.addEventListener('click', () => {
  sound.click(); weatherPinsOn = !weatherPinsOn;
  weatherPins.setVisible(weatherPinsOn); setSwitch(swWeatherPins, weatherPinsOn);
});
swPopulation?.addEventListener('click', () => {
  sound.click(); populationOn = !populationOn;
  population.setVisible(populationOn); setSwitch(swPopulation, populationOn);
});
swHeatmap?.addEventListener('click', () => {
  sound.click(); heatmapOn = !heatmapOn;
  travelHeatmap.setVisible(heatmapOn, true); setSwitch(swHeatmap, heatmapOn);
});

// Auto-on heatmap event from travelHeatmap.js
document.addEventListener('heatmap-auto-on', () => {
  heatmapOn = true; setSwitch(swHeatmap, true);
});

// Rebuild heatmap and weather whenever pins change
pinChangeHooks.push(() => {
  travelHeatmap.rebuild();
  if (weatherPinsOn) weatherPins.rebuild();
});

// Wire weather into pin card
pins.setCardExtras((pin) => weatherPinsOn ? weatherPins.cardHtml(pin.id) : '');

// Refresh flights every 60 s while on
setInterval(() => { if (flightsOn) liveFlights.refresh(); }, 60 * 1000);

// Seismic timeline shows/hides with the seismic layer (fires after main toggle)
swSeismic.addEventListener('click', () => {
  // At this point seismicOn has already been toggled by the earlier listener
  if (seismicOn) seismicTimeline.show(); else seismicTimeline.hide();
});

// Screenshot button
document.getElementById('btn-screenshot')?.addEventListener('click', () => {
  sound.click();
  if (screenshotMode.isClean()) { screenshotMode.toggleClean(); return; }
  // Long-press = clean mode, single tap = capture
  screenshotMode.capture();
});

// ── Cinematic mode ───────────────────────────────────────────────────────────
const cinematic = createCinematic({
  earthView, sound,
  getVisitedPins: () => pins.getPins().filter((p) => p.type === 'visited')
    .sort((a, b) => (a.dateAdded || '').localeCompare(b.dateAdded || '')),
});
const btnCinematic = document.getElementById('btn-cinematic');
btnCinematic.addEventListener('click', () => {
  sound.click();
  const visited = pins.getPins().filter((p) => p.type === 'visited').length;
  if (visited < 2) {
    btnCinematic.setAttribute('title', 'Add 2+ visited pins to unlock');
    setHint('Add 2+ visited pins to unlock Cinematic mode');
    setTimeout(() => { if (mode === 'earth' && !cinematic.isActive()) setHint(EARTH_HINT); }, 2200);
    return;
  }
  layersPanel.classList.remove('open');
  btnLayers.classList.remove('active');
  cinematic.start();
  challenges.markCinematicUsed();
});

// ── Six-feature pass: planner, visa, challenges, surprise, AI, year review ────

// Smoothly fly the Earth camera to a lat/lng (used by Surprise Me). Frames the
// point centred by flying along its current world normal, then hands control back.
function flyToLatLng(lat, lng) {
  earthView.setSpin(false);
  earthView.controls.enabled = false;
  earthView.earth.updateMatrixWorld();
  const worldDir = localFromLatLng(lat, lng, 1).applyQuaternion(earthView.earth.quaternion).normalize();
  const fromPos = earthView.camera.position.clone();
  const endPos = worldDir.multiplyScalar(2.7);
  tween({
    duration: 1200,
    onUpdate: (k) => {
      earthView.camera.position.lerpVectors(fromPos, endPos, k);
      earthView.camera.lookAt(ORIGIN);
    },
    onComplete: () => {
      earthView.controls.target.copy(ORIGIN);
      if (!busy()) earthView.controls.enabled = true;
      earthView.setSpin(true);
    },
  });
}

visa.mountSelector();

const challenges = createChallenges({ getPins: pins.getPins, getTrips: pins.getTrips, sound });
pinChangeHooks.push(() => challenges.check());

const tripPlanner = createTripPlanner({
  earthView, getPins: pins.getPins, sound, setHint, earthHint: EARTH_HINT,
  startJourney: (waypoints) => { cinematic.start(waypoints); challenges.markCinematicUsed(); },
});
pinChangeHooks.push(() => tripPlanner.refresh());

const surprise = createSurprise({
  getPins: pins.getPins, addWishlistPin: pins.addWishlistPin, flyTo: flyToLatLng, sound,
});

const aiSuggester = createAISuggester({
  getPins: pins.getPins, addWishlistPin: pins.addWishlistPin, sound,
});

const yearReview = createYearReview({ getPins: pins.getPins, getTrips: pins.getTrips, sound });

// Buttons
// (btn-surprise and btn-challenges wire their own click handlers inside their modules)
document.getElementById('btn-planner').addEventListener('click', () => { sound.click(); tripPlanner.toggle(); });
document.getElementById('stats-suggest').addEventListener('click', () => { stats.close(); aiSuggester.open(); });
document.getElementById('stats-year').addEventListener('click', () => { stats.close(); yearReview.open(); });
document.getElementById('profile-suggest').addEventListener('click', () => { profile.close(); aiSuggester.open(); });

// ── City search ───────────────────────────────────────────────────────────────
const citySearch = createCitySearch({
  flyTo: flyToLatLng,
  openAddAtLatLng: pins.openAddAtLatLng,
  sound,
});

// ── Sign out ──────────────────────────────────────────────────────────────────
document.getElementById('btn-signout').addEventListener('click', async () => {
  try { await supabase.auth.signOut(); } catch (e) {}
  localStorage.removeItem('wanderglobe_user');
  window.location.href = '/';
});

// Wire challenge unlock → Supabase
challenges.setOnUnlock((id, date) => {
  const email = getCurrentUserEmail();
  if (email) cloudSync.saveChallenge(email, id, date);
});

// "Share My Globe" button — copy the share URL to clipboard
document.getElementById('profile-share-btn').addEventListener('click', () => {
  const email = getCurrentUserEmail();
  const note = document.getElementById('profile-share-note');
  if (!email) { if (note) note.textContent = 'Sign in to generate a share link.'; return; }
  const url = `https://earth-simulator-two.vercel.app/globe?share=${emailSlug(email)}`;
  navigator.clipboard.writeText(url).then(
    () => { if (note) note.textContent = '✓ Link copied!'; },
    () => { if (note) note.textContent = url; }
  );
  if (sound) sound.chime();
});

// ── Shared globe viewer (read-only, ?share=slug in URL) ──────────────────────
const _shareSlug = new URLSearchParams(window.location.search).get('share');
if (_shareSlug) {
  cloudSync.fetchSharedGlobe(_shareSlug).then((globe) => {
    if (!globe) return;
    const banner = document.getElementById('viewer-banner');
    const ownerName = globe.user && globe.user.name ? (globe.user.name + "'s") : 'a';
    document.getElementById('viewer-name').textContent = `👁 Viewing ${ownerName} Globe`;
    banner.hidden = false;
    pins.loadSharedPins(globe.pins, globe.trips);
  });
}

// ── Loading screen ─────────────────────────────────────────────────────────
// Hold the globe behind a full-screen loader until every texture is in, then
// fade through. `ready` gates all interaction until that's done.
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const toastEl = document.getElementById('welcome-toast');
const loadStart = performance.now();
let ready = false;

earthView.controls.enabled = false; // no interaction until loaded

loadingManager.onProgress = (url, loaded, total) => {
  loaderFill.style.transform = `scaleX(${total ? loaded / total : 1})`;
};
loadingManager.onError = () => {};
loadingManager.onLoad = () => {
  const elapsed = performance.now() - loadStart;
  setTimeout(revealGlobe, Math.max(0, 750 - elapsed));
};

function revealGlobe() {
  if (ready) return;
  ready = true;
  loaderFill.style.transform = 'scaleX(1)';
  loaderEl.classList.add('done');
  earthView.controls.enabled = true;
  if (!_shareSlug) pins.showChrome(); // hide all pin chrome in viewer mode
  setHint(EARTH_HINT);
  showWelcomeBack();
  doCloudPullOnLoad(); // async, non-blocking — updates pin layer when data arrives
}

// Handle OAuth callback (Google / Apple login redirects to /globe/).
// If Supabase has a fresh session and localStorage has no user yet, auto-create
// the profile from the provider's metadata (name, email, avatar).
async function handleAuthSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const u = session.user;
    const existing = getCurrentUserEmail();
    if (!existing) {
      const prof = {
        name: u.user_metadata?.full_name || u.user_metadata?.name || (u.email || '').split('@')[0] || 'Traveller',
        email: u.email,
        avatar: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
        memberSince: String(new Date().getFullYear()),
      };
      localStorage.setItem('wanderglobe_user', JSON.stringify(prof));
      profile.refresh();
      cloudSync.upsertUser(prof);
    }
  } catch (e) {}
}

// Pull cloud state once per session; merges into the live pin layer seamlessly.
async function doCloudPullOnLoad() {
  await handleAuthSession();
  const email = getCurrentUserEmail();
  if (!email) return;
  try {
    const [cloudPins, cloudTrips, cloudUnlocked] = await Promise.all([
      cloudSync.pullPins(email, pins.getPins()),
      cloudSync.pullTrips(email, pins.getTrips()),
      cloudSync.pullChallenges(email, null),
    ]);
    if (cloudPins || cloudTrips) {
      pins.replaceStore(cloudPins || pins.getPins(), cloudTrips || pins.getTrips());
    }
    if (cloudUnlocked) challenges.setMergeUnlocked(cloudUnlocked);
  } catch (e) { /* offline — localStorage remains the source */ }
}

// Returning visitor (name saved by the landing page) → a gentle toast.
function showWelcomeBack() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('wanderglobe_user')); } catch (e) {}
  if (!user || !user.name) return;
  toastEl.textContent = `Welcome back, ${user.name}`;
  setTimeout(() => {
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
  }, 500);
}

// ── App state ────────────────────────────────────────────────────────────────
let mode = 'earth';        // 'earth' (close-up) or 'solar'
let transitioning = false; // mid view-swap (fade in progress)
let flying = false;        // mid camera flight to/from a planet
let focusedBody = null;    // the planet/Sun we're looking at, or null
const busy = () => transitioning || flying;

const EARTH_EXIT_DIST = 8.5; // zoom past this on Earth → enter the solar system
const ORIGIN = new THREE.Vector3(0, 0, 0);
const OVERVIEW_POS = new THREE.Vector3(0, 105, 210);  // full solar-system framing
const SOLAR_START_FAR = new THREE.Vector3(0, 270, 520); // where the fly-in starts (within zoom limit)

// ── Camera flights & fades (all eased tweens) ────────────────────────────────

// Fly a view's camera + orbit target to fixed end points.
function flyCamera(view, toPos, toTarget, duration, onComplete) {
  const fromPos = view.camera.position.clone();
  const fromTarget = view.controls.target.clone();
  tween({
    duration,
    onUpdate: (k) => {
      view.camera.position.lerpVectors(fromPos, toPos, k);
      view.controls.target.lerpVectors(fromTarget, toTarget, k);
    },
    onComplete,
  });
}

// Fly to a planet. Its end point is recomputed every frame because the planet
// keeps orbiting while we approach.
function flyToBody(body, onComplete) {
  const fromPos = solarView.camera.position.clone();
  const fromTarget = solarView.controls.target.clone();
  const dir = new THREE.Vector3(0.55, 0.32, 1).normalize(); // nice 3/4 angle
  const dist = body.radius * 4 + 1.5;
  const endTarget = new THREE.Vector3();
  const endPos = new THREE.Vector3();
  tween({
    duration: 1200,
    onUpdate: (k) => {
      solarView.bodyPosition(body, endTarget);
      endPos.copy(dir).multiplyScalar(dist).add(endTarget);
      solarView.camera.position.lerpVectors(fromPos, endPos, k);
      solarView.controls.target.lerpVectors(fromTarget, endTarget, k);
    },
    onComplete,
  });
}

// Animate the black overlay's opacity.
function fade(to, duration, onComplete) {
  const from = parseFloat(fadeEl.style.opacity || '0');
  tween({
    duration,
    onUpdate: (k) => { fadeEl.style.opacity = (from + (to - from) * k).toFixed(3); },
    onComplete,
  });
}

// ── View transitions (camera fly + fade, never one giant zoom) ───────────────

// Earth close-up  →  solar system.
function goToSolar() {
  transitioning = true;
  earthView.controls.enabled = false;
  pins.hideChrome(); // exits pin mode, closes any open sheet, hides the tally
  stats.close();
  profile.close();
  weatherBadge.classList.remove('show');
  if (cinematic.isActive()) cinematic.exit();
  layersPanel.classList.remove('open');
  btnLayers.classList.remove('active');
  featureCard.classList.remove('show');
  countryTip.classList.remove('show');
  tripPlanner.close();
  surprise.close();
  challenges.close();
  aiSuggester.close();
  yearReview.close();
  sound.whoosh();
  flyCamera(earthView, new THREE.Vector3(0, 0, 16), ORIGIN, 700); // pull away from Earth
  fade(1, 650, () => {
    mode = 'solar';
    sound.setAmbient('solar');
    focusedBody = null;
    solarView.clearFocus();
    solarView.controls.enabled = false;
    solarView.controls.minDistance = 3;
    solarView.controls.maxDistance = 600;
    solarView.camera.position.copy(SOLAR_START_FAR);
    solarView.controls.target.copy(ORIGIN);
    showSolarChrome();
    flyCamera(solarView, OVERVIEW_POS, ORIGIN, 1300, () => {
      transitioning = false;
      solarView.controls.enabled = true;
    });
    fade(0, 900);
  });
}

// Solar system  →  Earth close-up.
function goToEarth() {
  transitioning = true;
  solarView.controls.enabled = false;
  sound.stopRumble();
  sound.reentry();
  infoPanel.hide();
  solarView.clearFocus();
  focusedBody = null;
  hideAllChrome();
  fade(1, 650, () => {
    mode = 'earth';
    sound.setAmbient('earth');
    earthView.reset();
    earthView.controls.enabled = false;
    pins.showChrome();
    if (weatherReady) weatherBadge.classList.add('show');
    setHint(EARTH_HINT);
    fade(0, 800, () => {
      transitioning = false;
      earthView.controls.enabled = true;
    });
  });
}

// ── Focusing a planet / the Sun ──────────────────────────────────────────────
function focusBody(body) {
  if (body === focusedBody) return;
  sound.stopRumble(); // in case we're switching away from the black hole
  infoPanel.hide();
  solarView.clearFocus();
  focusedBody = body;
  flying = true;
  solarView.controls.enabled = false;
  solarView.controls.minDistance = Math.max(0.4, body.radius * 1.25);
  solarView.controls.maxDistance = 800;
  btnBack.classList.add('visible');
  setHint('Tap empty space or “Back” to return');
  sound.whoosh();
  if (body.rumble) sound.startRumble(); // deep gravitational rumble on the black hole
  flyToBody(body, () => {
    flying = false;
    solarView.controls.enabled = true;
    solarView.setFocus(body);
    infoPanel.show(body);
    sound.chime();
  });
}

function unfocus() {
  sound.stopRumble(); // black-hole rumble fades when its card closes
  infoPanel.hide();
  solarView.clearFocus();
  focusedBody = null;
  flying = true;
  solarView.controls.enabled = false;
  solarView.controls.minDistance = 3;
  solarView.controls.maxDistance = 600;
  btnBack.classList.remove('visible');
  setHint('Tap a planet or the Sun to explore · drag to rotate · scroll or pinch to zoom');
  flyCamera(solarView, OVERVIEW_POS, ORIGIN, 1100, () => {
    flying = false;
    solarView.controls.enabled = true;
  });
}

// ── Small UI helpers ─────────────────────────────────────────────────────────
function setHint(text) { hintEl.textContent = text; }
function showSolarChrome() {
  btnEarth.classList.add('visible');
  btnBack.classList.remove('visible');
  setHint('Tap a planet or the Sun to explore · drag to rotate · scroll or pinch to zoom');
}
function hideAllChrome() {
  btnEarth.classList.remove('visible');
  btnBack.classList.remove('visible');
}

btnEarth.addEventListener('click', () => { sound.click(); if (mode === 'solar' && !busy()) goToEarth(); });
btnBack.addEventListener('click', () => { sound.click(); if (mode === 'solar' && !busy() && focusedBody) unfocus(); });

// ── Click / tap to select a body (or empty space to go back) ─────────────────
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickHit(clientX, clientY) {
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, solarView.camera);
  const hits = raycaster.intersectObjects(solarView.clickable, false);
  return hits.length ? hits[0] : null;
}
function pick(clientX, clientY) {
  const hit = pickHit(clientX, clientY);
  return hit ? hit.object.userData.body : null;
}

// Raycast the Earth's surface (used when dropping a pin in Pin Mode).
function pickEarthSurface(clientX, clientY) {
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, earthView.camera);
  const hits = raycaster.intersectObject(earthView.earth, false);
  return hits.length ? hits[0] : null;
}

// Raycast the live seismic markers (quakes + volcanoes) → the hit's feature data.
function pickSeismic(clientX, clientY) {
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, earthView.camera);
  const hits = raycaster.intersectObjects(seismic.getClickables(), false);
  return hits.length ? hits[0].object.userData.feature : null;
}

// ── Earthquake / volcano info card ────────────────────────────────────────────
const featureCard = document.getElementById('feature-card');
const featureBadge = document.getElementById('feature-badge');
const featureTitle = document.getElementById('feature-title');
const featureBody = document.getElementById('feature-body');
const countryTip = document.getElementById('country-tip');
let lastCountryHover = 0;

function fbRow(label, value) { return `<div class="fb-row"><span>${label}</span><span>${value}</span></div>`; }
function showFeature(f) {
  if (f.kind === 'quake') {
    featureBadge.textContent = `M ${f.mag != null ? f.mag.toFixed(1) : '?'}`;
    featureBadge.className = 'feature-badge quake';
    featureTitle.textContent = f.place || 'Earthquake';
    featureBody.innerHTML =
      fbRow('Magnitude', f.mag != null ? f.mag.toFixed(1) : '—') +
      fbRow('Depth', (f.depthKm != null ? Math.round(f.depthKm) : '—') + ' km') +
      fbRow('When', f.time ? new Date(f.time).toLocaleString() : '—');
  } else {
    featureBadge.textContent = 'Volcano';
    featureBadge.className = 'feature-badge volcano';
    featureTitle.textContent = f.name || 'Volcano';
    featureBody.innerHTML =
      fbRow('Country', f.country || '—') +
      fbRow('Type', f.type || '—') +
      fbRow('Elevation', (f.elevation != null ? f.elevation.toLocaleString() : '—') + ' m') +
      fbRow('Last eruption', f.lastEruption || '—');
  }
  featureCard.classList.add('show');
  featureCard.setAttribute('aria-hidden', 'false');
  sound.chime();
}
document.getElementById('feature-close').addEventListener('click', () => {
  featureCard.classList.remove('show');
  sound.click();
});

// A tap is a press + release that barely moved (so it isn't a drag-rotate).
let pointerDown = null;
let longPressTimer = null;
let longPressFired = false;

function clearLongPress() {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
}

canvas.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  longPressFired = false;
  // Long-press an existing pin (when not in Pin Mode) → edit it.
  if (mode === 'earth' && ready && !busy() && !pins.isPinMode()) {
    longPressTimer = setTimeout(() => {
      const id = pins.pickPin(e.clientX, e.clientY);
      if (id) { longPressFired = true; pins.openEdit(id); }
    }, 550);
  }
});

// Cancel the long-press if the finger/cursor moves (that's a drag-rotate).
canvas.addEventListener('pointermove', (e) => {
  if (longPressTimer && pointerDown &&
      Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 8) {
    clearLongPress();
  }
});
canvas.addEventListener('pointercancel', clearLongPress);

window.addEventListener('pointerup', (e) => {
  // In cinematic mode, a tap anywhere exits (after a short grace period).
  if (cinematic.isActive()) { if (cinematic.canExit()) cinematic.exit(); pointerDown = null; return; }
  const d = pointerDown;
  pointerDown = null;
  clearLongPress();
  if (!d || !ready || busy()) return;
  if (longPressFired) { longPressFired = false; return; } // edit already opened

  const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
  const isTap = moved <= 8 && performance.now() - d.t <= 500;

  if (mode === 'solar') {
    if (!isTap) return;
    const hit = pickHit(e.clientX, e.clientY);
    const body = hit ? hit.object.userData.body : null;
    if (body) {
      // For an asteroid-belt rock, anchor the card's lines at the exact click.
      if (body.dynamicAnchor && body !== focusedBody && body.object3d) {
        body.object3d.position.copy(hit.point);
      }
      focusBody(body);
    } else if (focusedBody) {
      unfocus();
    }
    return;
  }

  // Earth close-up view.
  if (!isTap) return;
  if (pins.isPinMode()) {
    if (pins.panelOpen()) return;            // finish the current pin first
    const hit = pickEarthSurface(e.clientX, e.clientY);
    if (hit) pins.openAdd(hit.point);
  } else {
    // Live flights click
    if (flightsOn) {
      ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
      ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(ndc, earthView.camera);
      const fhits = raycaster.intersectObjects(liveFlights.getClickables(), false);
      if (fhits.length) {
        const fd = liveFlights.getFlightData(fhits[0].instanceId);
        if (fd) {
          featureBadge.textContent = fd.callsign || 'Flight';
          featureBadge.className = 'feature-badge volcano';
          featureTitle.textContent = `✈️ ${fd.callsign || fd.icao24}`;
          featureBody.innerHTML =
            fbRow('Country', fd.country || '—') +
            fbRow('Altitude', fd.altM != null ? `${Math.round(fd.altM).toLocaleString()} m` : '—') +
            fbRow('Speed', fd.speedKmh != null ? `${Math.round(fd.speedKmh)} km/h` : '—') +
            fbRow('Heading', fd.heading != null ? `${Math.round(fd.heading)}°` : '—');
          featureCard.classList.add('show');
          featureCard.setAttribute('aria-hidden', 'false');
          sound.chime();
          return;
        }
      }
    }
    // ISS click
    {
      ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
      ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(ndc, earthView.camera);
      const issClickable = issTracker.getClickable();
      if (issClickable) {
        const ihits = raycaster.intersectObject(issClickable, false);
        if (ihits.length) {
          const info = issTracker.getInfo();
          featureBadge.textContent = 'ISS';
          featureBadge.className = 'feature-badge volcano';
          featureTitle.textContent = '🛸 International Space Station';
          featureBody.innerHTML =
            fbRow('Altitude', '408 km') +
            fbRow('Speed', '27,600 km/h') +
            fbRow('Latitude', info ? `${info.lat.toFixed(2)}°` : '—') +
            fbRow('Longitude', info ? `${info.lng.toFixed(2)}°` : '—') +
            fbRow('Visibility', info?.visibility || '—') +
            '<div class="fb-row" style="font-size:12px;color:rgba(233,238,252,0.5);margin-top:6px">The ISS orbits Earth every 90 minutes at ~17,500 mph, completing 16 sunrises per day.</div>';
          featureCard.classList.add('show');
          featureCard.setAttribute('aria-hidden', 'false');
          sound.chime();
          return;
        }
      }
    }
    if (seismicOn) {
      const f = pickSeismic(e.clientX, e.clientY);
      if (f) { showFeature(f); return; }
    }
    const id = pins.pickPin(e.clientX, e.clientY);
    if (id) { pins.openCard(id); return; }
    // Country facts click (no pin or seismic hit)
    {
      const hit = pickEarthSurface(e.clientX, e.clientY);
      if (hit) {
        const local = earthView.earth.worldToLocal(hit.point.clone());
        const ll = latLngFromLocal(local);
        const info = countries.hoverAt(ll.lat, ll.lng);
        if (info && info.name) countryFacts.show(info.name);
      }
    }
  }
});

// Right-click an existing pin → edit it.
canvas.addEventListener('contextmenu', (e) => {
  if (mode !== 'earth' || !ready || busy() || pins.isPinMode()) return;
  const id = pins.pickPin(e.clientX, e.clientY);
  if (id) { e.preventDefault(); pins.openEdit(id); }
});

// Hover a body in the solar view → play its unique tone (once per entry).
let hoveredKey = null;
let lastHoverCheck = 0;
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;          // touch has no hover
  if (!ready || mode !== 'solar' || busy()) { hoveredKey = null; return; }
  const now = performance.now();
  if (now - lastHoverCheck < 60) return;          // throttle the raycast
  lastHoverCheck = now;
  const body = pick(e.clientX, e.clientY);
  const key = body ? body.key : null;
  if (key !== hoveredKey) {
    hoveredKey = key;
    if (key) sound.hover(key);
    canvas.style.cursor = key ? 'pointer' : '';
  }
});

// Hover a pin in the Earth view → grow it and show a pointer cursor.
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  if (!ready || mode !== 'earth' || busy() || cinematic.isActive()) return;
  if (pins.isPinMode()) { pins.setHover(null); return; } // crosshair set on toggle
  const id = pins.pickPin(e.clientX, e.clientY);
  pins.setHover(id);
  canvas.style.cursor = id ? 'pointer' : '';

  // Country hover → tooltip + outline (throttled; only when the layer is on).
  if (countriesOn && countriesReadyFlag) {
    const now = performance.now();
    if (now - lastCountryHover > 80) {
      lastCountryHover = now;
      const hit = pickEarthSurface(e.clientX, e.clientY);
      let info = null;
      if (hit) {
        const local = earthView.earth.worldToLocal(hit.point.clone());
        const ll = latLngFromLocal(local);
        info = countries.hoverAt(ll.lat, ll.lng);
      } else {
        countries.hoverAt(null, null);
      }
      if (info) {
        const visaBadge = visa.badgeHtml(info.name);
        countryTip.innerHTML = info.name +
          (info.pinCount ? ` · <b>${info.pinCount} pin${info.pinCount === 1 ? '' : 's'}</b>` : '') +
          (visaBadge ? `<span class="visa-line">${visaBadge}</span>` : '');
        countryTip.style.left = (e.clientX + 14) + 'px';
        countryTip.style.top = (e.clientY + 14) + 'px';
        countryTip.classList.add('show');
      } else {
        countryTip.classList.remove('show');
      }
    }
  } else if (countryTip.classList.contains('show')) {
    countryTip.classList.remove('show');
  }
});

// Escape exits cinematic mode or closes the layers popover.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (cinematic.isActive()) cinematic.exit();
  else if (layersPanel.classList.contains('open')) {
    layersPanel.classList.remove('open');
    btnLayers.classList.remove('active');
  }
});

// ── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  earthView.resize();
  solarView.resize();
});

// ── Main loop ────────────────────────────────────────────────────────────────
setHint(EARTH_HINT);
let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  updateTweens(now);

  if (mode === 'earth') {
    earthView.update(dt);
    pins.update(dt);
    tripPlanner.update(dt);
    weather.update(dt);
    const sun = getSunDirection();
    aurora.update(sun, dt);
    terminator.update(sun, earthView.camera, dt);
    seismic.update(dt);
    countries.update(dt);
    issTracker.update(dt);
    // Ambient music: feed camera's Earth surface hit lat/lng
    if (!cinematic.isActive()) {
      const camHit = pickEarthSurface(window.innerWidth / 2, window.innerHeight / 2);
      if (camHit) {
        const local = earthView.earth.worldToLocal(camHit.point.clone());
        const ll = latLngFromLocal(local);
        ambientMusic.update(ll.lat, ll.lng);
      } else {
        ambientMusic.update(null, null);
      }
    }
    if (cinematic.isActive()) cinematic.update(dt);
    else if (!busy()) earthView.controls.update();
    renderer.render(earthView.scene, earthView.camera);
    // Pull back far enough (and not mid-task) → leave for the solar system.
    if (ready && !busy() && !cinematic.isActive() && !pins.panelOpen() && !stats.isOpen() && !profile.isOpen() &&
        !tripPlanner.isOpen() && !surprise.isOpen() && !challenges.isOpen() && !aiSuggester.isOpen() && !yearReview.isOpen() &&
        earthView.getDistance() > EARTH_EXIT_DIST) goToSolar();
  } else {
    solarView.update(dt);
    if (!busy()) solarView.controls.update();
    renderer.render(solarView.scene, solarView.camera);
    if (solarView.isFocused()) {
      const p = solarView.focusScreenPos();
      infoPanel.update(p.x, p.y);
    }
  }
}
requestAnimationFrame(animate);
