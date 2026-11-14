// Auction Max-Buy Calculator — floating panel injected into the page.
// Rendered inside a closed Shadow DOM so auction-site CSS can't break it.
(() => {
  if (window.top !== window || window.__maxBuyCalc) return;
  window.__maxBuyCalc = true;

  const MARKUP = 1.25; // 125% of JD Power Clean Trade

  const FIELDS = [
    { key: 'cleanTrade', label: 'JD Power Clean Trade', perVehicle: true },
    { key: 'profit', label: 'Target Profit' },
    { key: 'transport', label: 'Transport' },
    { key: 'buyFee', label: 'Buy Fee' },
    { key: 'recon', label: 'Est. Recon', perVehicle: true },
  ];

  const money = (n) =>
    (n < 0 ? '-$' : '$') +
    Math.abs(Math.round(n)).toLocaleString('en-US');

  const parse = (s) => {
    const n = parseFloat(String(s ?? '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  let root = null;
  let els = {};
  let state = {
    values: {},
    opacity: 0.8,
    pos: { top: 80, left: null, right: 24 },
    collapsed: false,
  };

  const save = () =>
    chrome.storage.local.set({
      values: state.values,
      opacity: state.opacity,
      pos: state.pos,
      collapsed: state.collapsed,
    });

  const CSS = `
    :host { all: initial; }
    .panel {
      position: fixed; z-index: 2147483647; width: 290px;
      font: 13px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #f1f5f9; background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,.35);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      transition: opacity .15s ease; user-select: none;
    }
    .panel:hover, .panel:focus-within { opacity: 1 !important; }
    .head {
      display: flex; align-items: center; gap: 6px; padding: 8px 10px;
      cursor: move; border-bottom: 1px solid rgba(148,163,184,.25);
    }
    .title { flex: 1; font-weight: 600; font-size: 12px; letter-spacing: .03em; text-transform: uppercase; color: #cbd5e1; }
    .hbtn {
      all: unset; cursor: pointer; width: 22px; height: 22px; border-radius: 6px;
      display: grid; place-items: center; color: #cbd5e1; font-size: 14px;
    }
    .hbtn:hover { background: rgba(148,163,184,.2); color: #fff; }
    .body { padding: 10px; display: grid; gap: 7px; }
    .collapsed .body { display: none; }
    .collapsed .head { border-bottom: 0; }
    .mini { display: none; font-weight: 700; color: #4ade80; font-size: 13px; }
    .collapsed .mini { display: block; }
    .row { display: grid; grid-template-columns: 1fr 108px; align-items: center; gap: 8px; }
    label { color: #cbd5e1; }
    input[type=text] {
      all: unset; box-sizing: border-box; width: 100%; padding: 5px 8px;
      background: rgba(255,255,255,.08); border: 1px solid rgba(148,163,184,.35);
      border-radius: 6px; text-align: right; color: #fff; font-variant-numeric: tabular-nums;
      user-select: text;
    }
    input[type=text]:focus { border-color: #60a5fa; background: rgba(255,255,255,.13); }
    .calc { display: flex; justify-content: space-between; color: #94a3b8; font-variant-numeric: tabular-nums; padding: 0 2px; }
    .calc b { color: #e2e8f0; font-weight: 600; }
    .sep { height: 1px; background: rgba(148,163,184,.25); margin: 2px 0; }
    .result {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 8px 10px; border-radius: 8px; background: rgba(34,197,94,.15);
      border: 1px solid rgba(34,197,94,.4);
    }
    .result span { font-weight: 600; color: #bbf7d0; }
    .result b { font-size: 20px; color: #4ade80; font-variant-numeric: tabular-nums; }
    .result.neg { background: rgba(239,68,68,.15); border-color: rgba(239,68,68,.45); }
    .result.neg span { color: #fecaca; } .result.neg b { color: #f87171; }
    .btns { display: grid; grid-template-columns: 1fr auto; gap: 6px; }
    .btn {
      all: unset; cursor: pointer; text-align: center; padding: 8px 10px; border-radius: 8px;
      font-weight: 600; background: #2563eb; color: #fff;
    }
    .btn:hover { background: #1d4ed8; }
    .btn.ghost { background: rgba(148,163,184,.18); color: #e2e8f0; font-weight: 500; }
    .btn.ghost:hover { background: rgba(148,163,184,.3); }
    .btn.ok { background: #16a34a; }
    .opacity { display: flex; align-items: center; gap: 8px; color: #94a3b8; font-size: 11px; }
    .opacity input { flex: 1; accent-color: #60a5fa; }
  `;

  function build() {
    const host = document.createElement('div');
    host.id = 'max-buy-calculator-host';
    const shadow = host.attachShadow({ mode: 'closed' });

    const rows = FIELDS.map(
      (f) => `
        <div class="row">
          <label for="${f.key}">${f.label}</label>
          <input type="text" id="${f.key}" inputmode="decimal" placeholder="$0" autocomplete="off">
        </div>
        ${f.key === 'cleanTrade' ? `<div class="calc"><span>125% of Clean Trade</span><b id="marked">$0</b></div><div class="sep"></div>` : ''}`
    ).join('');

    shadow.innerHTML = `
      <style>${CSS}</style>
      <div class="panel" id="panel">
        <div class="head" id="head">
          <div class="title">Max Buy Calc</div>
          <div class="mini" id="mini">$0</div>
          <button class="hbtn" id="collapse" title="Collapse">–</button>
          <button class="hbtn" id="close" title="Hide (Alt+Shift+A)">×</button>
        </div>
        <div class="body">
          ${rows}
          <div class="sep"></div>
          <div class="result" id="result"><span>Max Purchase</span><b id="max">$0</b></div>
          <div class="btns">
            <button class="btn" id="copy">Copy to Notes</button>
            <button class="btn ghost" id="clear" title="Clear Clean Trade + Recon for the next vehicle">New</button>
          </div>
          <div class="opacity">
            <span>Transparency</span>
            <input type="range" id="opacity" min="0.3" max="1" step="0.05">
          </div>
        </div>
      </div>`;

    const $ = (id) => shadow.getElementById(id);
    els = {
      host, panel: $('panel'), head: $('head'), mini: $('mini'),
      marked: $('marked'), max: $('max'), result: $('result'),
      copy: $('copy'), clear: $('clear'), opacity: $('opacity'),
      collapse: $('collapse'), close: $('close'),
      inputs: Object.fromEntries(FIELDS.map((f) => [f.key, $(f.key)])),
    };

    // Keep the auction site's keyboard shortcuts from firing while typing here.
    for (const t of ['keydown', 'keyup', 'keypress']) {
      els.panel.addEventListener(t, (e) => e.stopPropagation());
    }

    for (const f of FIELDS) {
      const input = els.inputs[f.key];
      input.value = state.values[f.key] ?? '';
      input.addEventListener('input', () => {
        state.values[f.key] = input.value;
        render();
        save();
      });
      input.addEventListener('blur', () => {
        if (input.value.trim() !== '') {
          input.value = money(parse(input.value));
          state.values[f.key] = input.value;
          save();
        }
      });
      input.addEventListener('focus', () => input.select());
    }

    els.opacity.value = state.opacity;
    els.opacity.addEventListener('input', () => {
      state.opacity = parseFloat(els.opacity.value);
      applyLayout();
      save();
    });

    els.copy.addEventListener('click', copyNote);
    els.clear.addEventListener('click', () => {
      for (const f of FIELDS.filter((f) => f.perVehicle)) {
        state.values[f.key] = '';
        els.inputs[f.key].value = '';
      }
      render();
      save();
      els.inputs.cleanTrade.focus();
    });
    els.collapse.addEventListener('click', () => {
      state.collapsed = !state.collapsed;
      applyLayout();
      save();
    });
    els.close.addEventListener('click', () => chrome.storage.local.set({ visible: false }));

    enableDrag();
    document.documentElement.appendChild(host);
    applyLayout();
    render();
  }

  function compute() {
    const v = Object.fromEntries(FIELDS.map((f) => [f.key, parse(state.values[f.key])]));
    const marked = v.cleanTrade * MARKUP;
    const max = marked - v.profit - v.transport - v.buyFee - v.recon;
    return { ...v, marked, max };
  }

  function render() {
    const c = compute();
    els.marked.textContent = money(c.marked);
    els.max.textContent = money(c.max);
    els.mini.textContent = money(c.max);
    els.result.classList.toggle('neg', c.max < 0);
  }

  function noteText() {
    const c = compute();
    const date = new Date().toLocaleDateString('en-US');
    return (
      `MAX BUY: ${money(c.max)} | ` +
      `JDP Clean Trade ${money(c.cleanTrade)} x125% = ${money(c.marked)} | ` +
      `Profit ${money(c.profit)} | Transport ${money(c.transport)} | ` +
      `Buy Fee ${money(c.buyFee)} | Recon ${money(c.recon)} | ${date}`
    );
  }

  async function copyNote() {
    const text = noteText();
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Fallback for pages where the async clipboard API is blocked.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    }
    els.copy.textContent = ok ? 'Copied!' : 'Copy failed';
    els.copy.classList.toggle('ok', ok);
    setTimeout(() => {
      els.copy.textContent = 'Copy to Notes';
      els.copy.classList.remove('ok');
    }, 1500);
  }

  function applyLayout() {
    const p = els.panel;
    p.style.opacity = state.opacity;
    p.classList.toggle('collapsed', state.collapsed);
    els.collapse.textContent = state.collapsed ? '+' : '–';
    els.collapse.title = state.collapsed ? 'Expand' : 'Collapse';
    const { top, left, right } = state.pos;
    p.style.top = clamp(top, 0, window.innerHeight - 40) + 'px';
    if (left != null) {
      p.style.left = clamp(left, 0, window.innerWidth - 80) + 'px';
      p.style.right = 'auto';
    } else {
      p.style.right = (right ?? 24) + 'px';
      p.style.left = 'auto';
    }
  }

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  function enableDrag() {
    let start = null;
    els.head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = els.panel.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, top: r.top, left: r.left };
      els.head.setPointerCapture(e.pointerId);
    });
    els.head.addEventListener('pointermove', (e) => {
      if (!start) return;
      state.pos = {
        top: start.top + e.clientY - start.y,
        left: start.left + e.clientX - start.x,
        right: null,
      };
      applyLayout();
    });
    els.head.addEventListener('pointerup', () => {
      if (start) save();
      start = null;
    });
  }

  function setVisible(visible) {
    if (visible && !root) {
      build();
      root = els.host;
    } else if (!visible && root) {
      root.remove();
      root = null;
    }
  }

  chrome.storage.local.get(['visible', 'values', 'opacity', 'pos', 'collapsed']).then((s) => {
    state.values = s.values ?? {};
    state.opacity = s.opacity ?? 0.8;
    state.pos = s.pos ?? state.pos;
    state.collapsed = s.collapsed ?? false;
    setVisible(!!s.visible);
  });

  // Sync across tabs: toggle visibility and pick up values typed in another tab.
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (ch.values && root) {
      state.values = ch.values.newValue ?? {};
      for (const f of FIELDS) {
        const input = els.inputs[f.key];
        if (input !== input.getRootNode().activeElement) input.value = state.values[f.key] ?? '';
      }
      render();
    }
    if (ch.visible) setVisible(!!ch.visible.newValue);
  });

  window.addEventListener('resize', () => root && applyLayout());
})();
