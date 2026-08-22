(() => {
  const OVERLAY_ID = "grid-ruler-overlay";
  const RULER_ID = "grid-ruler-ruler";
  const LEGEND_ID = "grid-ruler-legend";
  const FINE = 8;
  const MID = 32;
  const MAJOR = 128;
  let overlay = null;
  let ruler = null;
  let legend = null;

  function buildOverlay() {
    const o = document.createElement("div");
    o.id = OVERLAY_ID;
    const g = (dir, color, gap) =>
      `repeating-linear-gradient(${dir}, ${color} 0 1px, transparent 1px ${gap}px)`;
    o.style.cssText = [
      "position:fixed", "inset:0", "z-index:2147483646", "pointer-events:none",
      "background-image:" + [
        g("to right", "rgba(0,120,255,0.18)", FINE),
        g("to bottom", "rgba(0,120,255,0.18)", FINE),
        g("to right", "rgba(0,160,255,0.26)", MID),
        g("to bottom", "rgba(0,160,255,0.26)", MID),
        g("to right", "rgba(255,0,120,0.38)", MAJOR),
        g("to bottom", "rgba(255,0,120,0.38)", MAJOR)
      ].join(",")
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
      s.style.cssText = "position:absolute;font:11px/1.3 Menlo,Consolas,monospace;font-weight:700;color:#0ff;background:rgba(0,0,0,0.82);border:1px solid rgba(0,255,255,0.4);padding:0 3px;border-radius:2px;white-space:nowrap;";
      s.style.left = x + "px";
      s.style.top = y + "px";
      r.appendChild(s);
    }
    for (let x = 0; x <= w; x += MAJOR) tag(x, 0, String(x));
    for (let y = MAJOR; y <= h; y += MAJOR) tag(0, y, String(y));
    return r;
  }

  function buildLegend() {
    const lg = document.createElement("div");
    lg.id = LEGEND_ID;
    lg.style.cssText = "position:fixed;left:4px;bottom:4px;z-index:2147483647;pointer-events:none;display:flex;gap:8px;align-items:center;background:rgba(0,0,0,0.82);border:1px solid rgba(255,255,255,0.35);border-radius:4px;padding:3px 7px;font:11px/1 Menlo,Consolas,monospace;color:#eee;";
    const item = (color, label) => {
      const it = document.createElement("span");
      it.style.cssText = "display:inline-flex;align-items:center;gap:3px;";
      const sw = document.createElement("span");
      sw.style.cssText = "display:inline-block;width:8px;height:8px;background:" + color + ";";
      const tx = document.createElement("span");
      tx.textContent = label;
      it.appendChild(sw);
      it.appendChild(tx);
      return it;
    };
    lg.appendChild(item("rgba(0,120,255,0.9)", "8px"));
    lg.appendChild(item("rgba(0,160,255,0.9)", "32px"));
    lg.appendChild(item("rgba(255,0,120,0.9)", "128px"));
    return lg;
  }

  function enable() {
    if (!overlay) overlay = buildOverlay();
    if (!ruler) ruler = buildRuler();
    if (!legend) legend = buildLegend();
    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(ruler);
    document.documentElement.appendChild(legend);
    window.addEventListener("resize", refresh);
  }

  function disable() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
    const r = document.getElementById(RULER_ID);
    if (r) r.remove();
    const l = document.getElementById(LEGEND_ID);
    if (l) l.remove();
    overlay = null;
    ruler = null;
    legend = null;
    window.removeEventListener("resize", refresh);
  }

  function refresh() {
    if (!document.getElementById(OVERLAY_ID)) return;
    const r = document.getElementById(RULER_ID);
    if (r) r.remove();
    const nr = buildRuler();
    ruler = nr;
    document.documentElement.appendChild(nr);
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === "GRID_TOGGLE") {
        overlay ? disable() : enable();
        sendResponse({ ok: true });
      }
    });
  } else {
    document.getElementById(OVERLAY_ID) ? disable() : enable();
  }
})();
