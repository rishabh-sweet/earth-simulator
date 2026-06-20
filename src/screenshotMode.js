// Screenshot mode — hide chrome, capture canvas, preview + download.

export function createScreenshotMode({ renderer, getScene, getCamera }) {
  const modal        = document.getElementById('screenshot-modal');
  const previewImg   = document.getElementById('screenshot-preview');
  const dlBtn        = document.getElementById('screenshot-download');
  const closeBtn     = document.getElementById('screenshot-close');
  const chromeEls    = []; // filled on first use
  let cleanMode      = false;
  let lastDataUrl    = null;

  const CHROME_IDS = [
    'earth-tools', 'btn-sound', 'sync-status', 'offline-banner', 'pin-stats',
    'weather-badge', 'hint', 'city-search', 'search-pin-prompt', 'world-clock',
    'seismic-timeline', 'layers-panel',
  ];

  function gatherChrome() {
    if (chromeEls.length) return chromeEls;
    for (const id of CHROME_IDS) {
      const el = document.getElementById(id);
      if (el) chromeEls.push(el);
    }
    return chromeEls;
  }

  function hideChrome() { gatherChrome().forEach((el) => { el.dataset.ssHidden = el.style.visibility || ''; el.style.visibility = 'hidden'; }); }
  function showChrome() { gatherChrome().forEach((el) => { el.style.visibility = el.dataset.ssHidden || ''; delete el.dataset.ssHidden; }); }

  function capture() {
    hideChrome();
    // Let the browser paint the hidden state first
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          renderer.render(getScene(), getCamera());
          lastDataUrl = renderer.domElement.toDataURL('image/png');
        } catch (e) {
          lastDataUrl = null;
        }
        showChrome();
        if (lastDataUrl) showPreview(lastDataUrl);
      });
    });
  }

  function showPreview(dataUrl) {
    if (previewImg) previewImg.src = dataUrl;
    if (modal) modal.classList.add('open');
  }

  dlBtn?.addEventListener('click', () => {
    if (!lastDataUrl) return;
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.download = `wanderglobe-screenshot-${date}.png`;
    a.href = lastDataUrl;
    a.click();
  });

  closeBtn?.addEventListener('click', () => {
    modal?.classList.remove('open');
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (cleanMode) exitClean();
      else modal?.classList.remove('open');
    }
  });

  function enterClean() {
    cleanMode = true;
    hideChrome();
    // Show a tiny "exit" pill
    const exit = document.getElementById('clean-exit');
    if (exit) exit.hidden = false;
    document.getElementById('btn-screenshot')?.classList.add('active');
  }

  function exitClean() {
    cleanMode = false;
    showChrome();
    const exit = document.getElementById('clean-exit');
    if (exit) exit.hidden = true;
    document.getElementById('btn-screenshot')?.classList.remove('active');
  }

  document.getElementById('clean-exit')?.addEventListener('click', exitClean);

  return {
    capture,
    toggleClean() { cleanMode ? exitClean() : enterClean(); },
    isClean: () => cleanMode,
  };
}
