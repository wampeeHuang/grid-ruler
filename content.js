(() => {
  const OVERLAY_ID = "grid-ruler-overlay";
  const RULER_ID = "grid-ruler-ruler";
  const LEGEND_ID = "grid-ruler-legend";
  const FINE = 8;
  const MID = 32;
  const MAJOR = 128;
  const DEEP_GREEN = "#3E571C";
  const LEGEND_TITLE = "网格";
  // Panel default anchor: 32px clear of the viewport's bottom-right corner.
  const MARGIN = 32;
  // Drag threshold in px: a pointer that moves less than this is a CLICK
  // (layer toggle), not a drag (move the panel).
  const DRAG_SLOP = 3;
  // Panel geometry. 4 cells, cell 1 is narrower because 「网格」 is two chars:
  // content 38 + 28*3 = 122, plus the 1px border a side = 124 rendered, 30 tall.
  // NOTE: width/height are NOT set — the grid template sizes the content box, so
  // the two sources can never drift, and the 124/30 figure is exact, not hoped
  // for. Cells keep box-sizing:border-box so their own separators stay inside.
  const CELL = 28;
  const LABEL_CELL = 38;
  const PANEL_H = 30;
  const RADIUS = 8;
  const POS_KEY = "grid-ruler-panel-pos";
  function readPos() {
    try {
      const raw = sessionStorage.getItem(POS_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      return Number.isFinite(p.left) && Number.isFinite(p.top)
        ? { left: p.left, top: p.top } : null;
    } catch (_) { return null; }  // storage blocked (sandboxed frame) = default
  }
  function writePos() {
    try {
      if (panel) sessionStorage.setItem(POS_KEY, JSON.stringify(panel));
      else sessionStorage.removeItem(POS_KEY);
    } catch (_) {}
  }
  let panel = readPos();
  // Line colors with opacity hierarchy so 8/32/128 stay distinguishable:
  // major solid, mid 70%, fine 30%. Single source for both grid and legend.
  const LINE = {
    fine: "rgba(154,163,158,0.3)",
    mid: "rgba(116,166,63,0.7)",
    major: "#3E571C"
  };
  // Layer order for background-image stacking: FIRST listed = TOPMOST, so
  // major deep green on top, then mid green, fine gray at bottom.
  const TIERS = [[MAJOR, LINE.major], [MID, LINE.mid], [FINE, LINE.fine]];
  // Swatch color per layer + text color that stays readable on that swatch.
  const SWATCH = {
    8:  { bg: LINE.fine,  ink: "#3E571C" },
    32: { bg: LINE.mid,   ink: "#fff" },
    128: { bg: LINE.major, ink: "#fff" }
  };
  const LILFONT = "10px/1 Consolas,'ui-monospace',monospace";
  // Ruler numbers stay at the vivi-token 12px; LILFONT (10px) is only for the
  // small legend card cells.
  const FONT = "12px/1 Consolas,'ui-monospace',monospace";
  // Per-layer on/off + master on/off. Master is driven by toolbar/shortcut
  // (GRID_TOGGLE); each layer toggles by clicking its swatch in the legend card.
  const state = { on: false, layers: { 8: true, 32: true, 128: true } };

  function buildOverlay() {
    const o = document.createElement("div");
    o.id = OVERLAY_ID;
    // Use background-size tiling, NOT repeating-linear-gradient: 1px repeating
    // gradients over a full-viewport element get smeared into a solid wash by
    // Chromium's gradient rasterizer. Tiled non-repeating gradients stay crisp.
    const layers = [];
    const add = (dir, color, gap, axis) => layers.push({
      img: `linear-gradient(${dir},${color} 0 1px,transparent 1px)`,
      size: axis === "x" ? `${gap}px 100%` : `100% ${gap}px`,
      repeat: axis === "x" ? "repeat-x" : "repeat-y"
    });
    for (const [gap, color] of TIERS) {
      if (!state.layers[gap]) continue;
      add("to right", color, gap, "x");
      add("to bottom", color, gap, "y");
    }
    o.style.cssText = [
      "position:fixed", "inset:0", "z-index:2147483646", "pointer-events:none",
      "background-image:" + layers.map(l => l.img).join(","),
      "background-size:" + layers.map(l => l.size).join(","),
      "background-repeat:" + layers.map(l => l.repeat).join(",")
    ].join(";");
    return o;
  }

  function buildRuler() {
    const r = document.createElement("div");
    r.id = RULER_ID;
    r.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;";
    const w = window.innerWidth, h = window.innerHeight;
    function tag(x, y, text) {
      const s = document.createElement("span");
      s.textContent = text;
      s.style.cssText = `position:absolute;font:400 ${FONT};color:${DEEP_GREEN};white-space:nowrap;`;
      s.style.left = x + "px";
      s.style.top = y + "px";
      r.appendChild(s);
    }
    for (let x = 0; x < w; x += MAJOR) tag(x, 0, String(x));
    for (let y = MAJOR; y < h; y += MAJOR) tag(0, y, String(y));
    return r;
  }

  // Switch card: 4 cells = 「网格」 label + one swatch per layer (8 -> 32 -> 128,
  // left to right). Each swatch toggles its own layer, and the whole card is
  // also the drag handle (no separate grip).
  function buildLegend() {
    const lg = document.createElement("div");
    lg.id = LEGEND_ID;
    lg.title = "拖动可移动面板 · 点 8/32/128 开关该层";
    lg.style.cssText = [
      "position:fixed", `right:${MARGIN}px`, `bottom:${MARGIN}px`, "z-index:2147483647",
      "display:grid", `grid-template-columns:${LABEL_CELL}px repeat(3,${CELL}px)`,
      `height:${PANEL_H}px`, "box-sizing:border-box",
      "background:#F9FBF9", "border:1px solid #DDE4B8", `border-radius:${RADIUS}px`,
      "box-shadow:0 2px 8px rgba(62,87,28,0.18)",
      "overflow:hidden", "user-select:none", "cursor:grab", "touch-action:none"
    ].join(";");
    // A stored position wins over the default anchor. Left/top are only ever
    // written after a real drag (DRAG_SLOP), so right/bottom still own the
    // pre-drag layout and there is no first-frame jump.
    if (panel) {
      lg.style.right = "auto";
      lg.style.bottom = "auto";
      lg.style.left = panel.left + "px";
      lg.style.top = panel.top + "px";
    }
    const title = document.createElement("div");
    title.textContent = LEGEND_TITLE;
    title.style.cssText = [
      "display:flex", "align-items:center", "justify-content:center",
      `font:400 ${LILFONT}`, "color:#9AA39E"
    ].join(";");
    lg.appendChild(title);
    for (const gap of [FINE, MID, MAJOR]) lg.appendChild(layerCell(gap));
    attachDrag(lg);
    return lg;
  }

  // Move the panel like an IME candidate window: press anywhere on it, drag,
  // release. A press that never travels DRAG_SLOP px stays a click and toggles
  // the swatch under it.
  function attachDrag(el) {
    let id = null, dx = 0, dy = 0, ox = 0, oy = 0, moved = false, dragged = false;
    el.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      const r = el.getBoundingClientRect();
      id = e.pointerId; dx = e.clientX - r.left; dy = e.clientY - r.top;
      ox = e.clientX; oy = e.clientY;
      moved = false; dragged = false;
      // Capture NOW, not on the first move: once the pointer leaves the panel
      // mid-drag, an uncaptured pointermove is delivered to whatever is
      // underneath (verified: events retarget to <body>), so the panel would
      // freeze under a fast cursor. Capture keeps every move on the panel.
      try { el.setPointerCapture(id); } catch (_) {}
    });
    el.addEventListener("pointermove", e => {
      if (e.pointerId !== id) return;
      // Under the threshold this is still a press, not a drag — judged against
      // the press origin, because capture retargets moves to this panel.
      if (!moved) {
        if (Math.hypot(e.clientX - ox, e.clientY - oy) < DRAG_SLOP) return;
        moved = true;
        el.style.cursor = "grabbing";
      }
      applyDrag(el, e.clientX - dx, e.clientY - dy);
    });
    const end = e => {
      if (e.pointerId !== id) return;
      id = null;
      el.style.cursor = "grab";
      // `dragged` outlives `moved` on purpose: pointerup runs BEFORE the click,
      // so the click handler must still be able to tell a drag from a click.
      dragged = e.type === "pointerup" && moved;
      if (dragged) writePos();
      moved = false;
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    // Capture also retargets the follow-up `click` to this panel, so swatch
    // clicks are dispatched here from the pointer position instead of relying
    // on a per-cell handler. A drag never toggles anything.
    el.addEventListener("click", e => {
      if (dragged || !state.on) return;
      const hit = layerAt(el, e.clientX, e.clientY);
      if (hit) { e.stopPropagation(); e.preventDefault(); toggleLayer(hit); }
    }, true);
  }

  // Which layer's swatch covers the viewport point (null = label cell or gap).
  // Coordinates, because a captured drag hides which cell the press started on.
  function layerAt(el, x, y) {
    for (const c of el.querySelectorAll("[data-v]")) {
      const r = c.getBoundingClientRect();
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return +c.dataset.v;
    }
    return null;
  }

  // Clamp to the viewport so the panel can never be dragged (or resized) out
  // of reach, then commit the new position.
  function applyDrag(el, left, top) {
    const w = el.offsetWidth, h = el.offsetHeight;
    left = Math.max(0, Math.min(window.innerWidth - w, left));
    top = Math.max(0, Math.min(window.innerHeight - h, top));
    el.style.left = left + "px";
    el.style.top = top + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
    panel = { left, top };
  }

  // Keep a dragged panel inside a shrunken viewport; an undragged one keeps
  // its default 32px anchor (CSS right/bottom already clamp it).
  function syncLegend() {
    const lg = document.getElementById(LEGEND_ID);
    if (!lg || !panel) return;
    const w = lg.offsetWidth, h = lg.offsetHeight;
    panel = {
      left: Math.max(0, Math.min(window.innerWidth - w, panel.left)),
      top: Math.max(0, Math.min(window.innerHeight - h, panel.top))
    };
    lg.style.left = panel.left + "px";
    lg.style.top = panel.top + "px";
  }

  // Cells are plain divs: the panel's own click handler owns every toggle
  // (capture means a pointer click never reaches a cell handler anyway, so a
  // per-cell onclick would be a second, divergent code path).
  function layerCell(gap) {
    const c = document.createElement("div");
    c.dataset.v = gap;
    c.textContent = gap + "px";
    c.style.cssText = [
      "border-left:1px solid #DDE4B8", "box-sizing:border-box",
      "display:flex", "align-items:center", "justify-content:center",
      `font:600 ${LILFONT}`
    ].join(";");
    updateLayerCell(c);
    return c;
  }

  // Reflect a cell's layer state: active = colored swatch + readable ink,
  // off = transparent + gray number (the layer's switch is visually off).
  function updateLayerCell(c) {
    const gap = +c.dataset.v;
    const on = !!state.layers[gap];
    const s = SWATCH[gap];
    c.classList.toggle("off", !on);
    c.style.background = on ? s.bg : "transparent";
    c.style.color = on ? s.ink : "#9AA39E";
    c.style.opacity = on ? "1" : "0.5";
  }

  function enable() {
    if (state.on) return;
    state.on = true;
    document.documentElement.appendChild(buildOverlay());
    document.documentElement.appendChild(buildRuler());
    document.documentElement.appendChild(buildLegend());
    window.addEventListener("resize", refresh);
  }

  function disable() {
    // No state.on guard: the bookmarklet path runs a FRESH closure per click,
    // where state.on is always false — the "is it on?" answer is the DOM, not
    // this closure's state. Removal is idempotent, so unconditional is safe.
    state.on = false;
    [OVERLAY_ID, RULER_ID, LEGEND_ID].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    window.removeEventListener("resize", refresh);
  }

  function refresh() {
    if (!document.getElementById(OVERLAY_ID)) return;
    const r = document.getElementById(RULER_ID);
    if (r) r.remove();
    const nr = buildRuler();
    document.documentElement.appendChild(nr);
    syncLegend();
  }

  // Toggle one grid layer: rebuild overlay (drawn layers change), update the
  // legend card's swatch states in place.
  function toggleLayer(v) {
    if (!state.layers.hasOwnProperty(v)) return;
    state.layers[v] = !state.layers[v];
    if (!state.on) return;
    const o = document.getElementById(OVERLAY_ID);
    if (o) { o.remove(); document.documentElement.appendChild(buildOverlay()); }
    const l = document.getElementById(LEGEND_ID);
    if (l) l.querySelectorAll("[data-v]").forEach(updateLayerCell);
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === "GRID_TOGGLE") {
        state.on ? disable() : enable();
        sendResponse({ ok: true });
      }
    });
  } else {
    document.getElementById(OVERLAY_ID) ? disable() : enable();
  }
})();
