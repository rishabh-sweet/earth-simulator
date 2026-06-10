// Manages the HTML overlay shown when a body is focused: a big spaced-out
// name, a column of data callouts, and thin SVG lines linking each callout
// back to the body on screen. Pure DOM — it just needs the body's current
// screen position each frame.
const SVGNS = 'http://www.w3.org/2000/svg';

export function createInfoPanel() {
  const root = document.getElementById('info');
  const svg = document.getElementById('info-lines');
  const nameEl = document.getElementById('info-name');
  const calloutsEl = document.getElementById('info-callouts');

  let lines = []; // one SVG <line> per callout

  // Fill in a body's name + facts and fade the panel in.
  function show(body) {
    nameEl.textContent = body.name;

    calloutsEl.innerHTML = '';
    svg.innerHTML = '';
    lines = body.facts.map((fact) => {
      const item = document.createElement('div');
      item.className = 'callout';
      item.innerHTML =
        `<div class="callout-label">${fact.label}</div>` +
        `<div class="callout-value">${fact.value}</div>`;
      calloutsEl.appendChild(item);

      const line = document.createElementNS(SVGNS, 'line');
      line.setAttribute('class', 'callout-line');
      svg.appendChild(line);
      return { line, item };
    });

    root.classList.add('visible');
  }

  // Fade the panel out.
  function hide() {
    root.classList.remove('visible');
  }

  // Re-point every connector line at the body's current screen position.
  function update(bodyX, bodyY) {
    for (const { line, item } of lines) {
      const r = item.getBoundingClientRect();
      line.setAttribute('x1', bodyX);
      line.setAttribute('y1', bodyY);
      line.setAttribute('x2', r.left);          // left edge of the callout
      line.setAttribute('y2', r.top + r.height / 2);
    }
  }

  return { show, hide, update };
}
