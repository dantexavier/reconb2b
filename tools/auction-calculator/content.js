// Auction Max-Buy Calculator — floating panel injected into the page.
// Rendered inside a closed Shadow DOM so auction-site CSS can't break it.
(() => {
  if (window.top !== window || window.__maxBuyCalc) return;
  window.__maxBuyCalc = true;

  // ---- Tunable numbers -------------------------------------------------
  const MARKUP = 1.25; // bank ceiling = 125% of JD Power Clean Trade

  // Market days supply → where to price vs. market.
  const MDS_BANDS = [
    { below: 30, factor: 1.0, label: 'Hot' },
    { below: 60, factor: 1.0, label: 'Normal' },
    { below: 90, factor: 0.97, label: 'Slow' },
    { below: Infinity, factor: 0.94, label: 'Oversupplied' },
  ];
  // Days to sell = what you type in "Est. days to sell", or if that's blank
  // (and Sell at is blank too), the market days supply.

  // Price ↔ speed link: each 1% priced under market sells this much faster
  // (and each 1% over, this much slower). A starting guess — calibrate it.
  const FASTER_PER_POINT = 0.10; // 10% fewer days per 1% under market
  const SELL_AT_MIN = 80; // % of market
  const SELL_AT_MAX = 110;

  // ----------------------------------------------------------------------

  const FIELDS = {
    cleanTrade: { label: 'JD Power Clean Trade', perVehicle: true },
    market: { label: 'Market Value', perVehicle: true },
    mds: { label: 'Market Days Supply', perVehicle: true, kind: 'days' },
    sellAt: { label: 'Sell at (% of mkt)', perVehicle: true, kind: 'pct1' },
    days: { label: 'Est. days to sell', perVehicle: true, kind: 'days' },
    profit: { label: 'Target Profit' },
    transport: { label: 'Transport' },
    buyFee: { label: 'Buy Fee' },
    recon: { label: 'Est. Recon', perVehicle: true },
  };
  const KEYS = Object.keys(FIELDS);

  const money = (n) =>
    (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

  const parse = (s) => {
    const n = parseFloat(String(s ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const format = (key, s) => {
    const kind = FIELDS[key].kind;
    if (kind === 'days') return String(Math.round(parse(s)));
    if (kind === 'pct1') return fmtPct(parse(s));
    return money(parse(s));
  };
  const fmtPct = (n) => Math.round(n * 10) / 10 + '%';
  const PLACEHOLDER = { days: 'days', pct1: '%' };
  // Sell at % and days to sell drive each other: typing in one clears the other.
  const LINKED = { sellAt: 'days', days: 'sellAt' };

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
      position: fixed; z-index: 2147483647; width: 300px;
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
    .body {
      padding: 10px; display: grid; gap: 6px;
      max-height: calc(100vh - 140px); overflow-y: auto;
    }
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
    .calc { display: flex; justify-content: space-between; gap: 8px; color: #94a3b8; font-variant-numeric: tabular-nums; padding: 0 2px; }
    .calc b { color: #e2e8f0; font-weight: 600; text-align: right; }
    .calc.strong span { color: #cbd5e1; } .calc.strong b { color: #fff; }
    .warn { color: #fbbf24; font-size: 11px; padding: 0 2px; display: none; }
    .warn.on { display: block; }
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
    .maxnote { color: #94a3b8; font-size: 11px; text-align: center; }
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

  const row = (key) => `
    <div class="row">
      <label for="${key}">${FIELDS[key].label}</label>
      <input type="text" id="${key}" inputmode="decimal"
        placeholder="${PLACEHOLDER[FIELDS[key].kind] ?? '$0'}" autocomplete="off">
    </div>`;

  function build() {
    const host = document.createElement('div');
    host.id = 'max-buy-calculator-host';
    const shadow = host.attachShadow({ mode: 'closed' });

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
          ${row('cleanTrade')}
          <div class="calc"><span>Bank ceiling (125%)</span><b id="ceiling">$0</b></div>
          ${row('market')}
          ${row('mds')}
          ${row('sellAt')}
          ${row('days')}
          <div class="warn" id="clampWarn"></div>
          <div class="calc strong"><span>List price</span><b id="sale">$0</b></div>
          <div class="warn" id="capWarn">Market is above the bank ceiling: priced at the bank cap.</div>
          <div class="sep"></div>
          ${row('profit')}
          ${row('transport')}
          ${row('buyFee')}
          ${row('recon')}
          <div class="sep"></div>
          <div class="result" id="result"><span>Max Purchase</span><b id="max">$0</b></div>
          <div class="maxnote" id="maxNote"></div>
          <div class="btns">
            <button class="btn" id="copy">Copy to Notes</button>
            <button class="btn ghost" id="clear" title="Clear the per-car fields for the next vehicle">New</button>
          </div>
          <div class="opacity">
            <span>Transparency</span>
            <input type="range" id="opacity" min="0.3" max="1" step="0.05">
          </div>
        </div>
      </div>`;

    const $ = (id) => shadow.getElementById(id);
    els = {
      host,
      ...Object.fromEntries(
        ['panel', 'head', 'mini', 'ceiling', 'clampWarn', 'sale', 'capWarn',
          'max', 'result', 'maxNote',
          'copy', 'clear', 'opacity', 'collapse', 'close'].map((id) => [id, $(id)])
      ),
      inputs: Object.fromEntries(KEYS.map((k) => [k, $(k)])),
    };

    // Keep the auction site's keyboard shortcuts from firing while typing here.
    for (const t of ['keydown', 'keyup', 'keypress']) {
      els.panel.addEventListener(t, (e) => e.stopPropagation());
    }

    for (const key of KEYS) {
      const input = els.inputs[key];
      input.value = state.values[key] ?? '';
      input.addEventListener('input', () => {
        state.values[key] = input.value;
        const other = LINKED[key];
        if (other && input.value.trim() !== '') {
          state.values[other] = '';
          els.inputs[other].value = '';
        }
        render();
        save();
      });
      input.addEventListener('blur', () => {
        if (input.value.trim() !== '') {
          input.value = format(key, input.value);
          state.values[key] = input.value;
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
      for (const key of KEYS.filter((k) => FIELDS[k].perVehicle)) {
        state.values[key] = '';
        els.inputs[key].value = '';
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
    els.close.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'hide' }));

    enableDrag();
    document.documentElement.appendChild(host);
    applyLayout();
    render();
  }

  function compute() {
    const v = Object.fromEntries(KEYS.map((k) => [k, parse(state.values[k])]));

    const ceiling = v.cleanTrade * MARKUP;
    const band = v.mds > 0 ? MDS_BANDS.find((b) => v.mds < b.below) : null;

    // Starting point from the market: the MDS band's price, selling in MDS days.
    const mdsDays = v.mds > 0 ? v.mds : null;
    const basePct = band ? band.factor * 100 : 100;
    const r = 1 - FASTER_PER_POINT;
    const clampPct = (n) => Math.max(SELL_AT_MIN, Math.min(SELL_AT_MAX, n));

    // Whichever of Sell at % / days you typed drives the other.
    let sellPct = basePct;
    let days = mdsDays;
    let driver = null;
    let clamped = false;
    if (v.sellAt > 0) {
      driver = 'sellAt';
      sellPct = clampPct(v.sellAt);
      clamped = sellPct !== v.sellAt;
      if (mdsDays) days = mdsDays * Math.pow(r, basePct - sellPct);
    } else if (v.days > 0) {
      driver = 'days';
      days = v.days;
      if (mdsDays) {
        const want = basePct - Math.log(v.days / mdsDays) / Math.log(r);
        sellPct = clampPct(want);
        clamped = Math.abs(sellPct - want) > 0.05;
        // If the price hit a limit, the days that price actually gets you.
        if (clamped) days = mdsDays * Math.pow(r, basePct - sellPct);
      }
    }
    if (days) days = Math.max(1, Math.round(days));

    const marketPrice = v.market > 0 ? v.market * (sellPct / 100) : 0;

    // Sale price = lower of the bank ceiling and the (MDS-adjusted) market value.
    let sale = 0;
    if (ceiling > 0 && marketPrice > 0) sale = Math.min(ceiling, marketPrice);
    else sale = ceiling || marketPrice;
    const capped = ceiling > 0 && marketPrice > ceiling;

    // List price (the working price): round to the nearest $100, then − $5
    // (e.g. $16,573 → $16,600 → $16,595). Never above the bank ceiling: if
    // rounding up would cross it, round down instead.
    let list = 0;
    if (sale > 0) {
      list = Math.round(sale / 100) * 100 - 5;
      if (ceiling > 0 && list > ceiling) list = Math.floor(ceiling / 100) * 100 - 5;
    }

    const costs = v.transport + v.buyFee + v.recon;
    const max = list - v.profit - costs;

    return { ...v, ceiling, band, sale, list, capped, costs, max, mdsDays, days,
      sellPct, driver, clamped };
  }

  function render() {
    const c = compute();
    els.ceiling.textContent = money(c.ceiling);
    // The box you didn't type in shows the matching value in grey.
    els.inputs.sellAt.placeholder = fmtPct(c.sellPct);
    els.inputs.days.placeholder = c.days ? String(c.days) : 'days';
    let warn = '';
    if (c.clamped) {
      warn = `Sell at is limited to ${SELL_AT_MIN}–${SELL_AT_MAX}% of market` +
        (c.driver === 'days' ? ` — that gets you ~${c.days} days.` : '.');
    } else if (c.driver && !c.mdsDays) {
      warn = 'Enter Market Days Supply to link Sell at % and days to sell.';
    }
    els.clampWarn.textContent = warn;
    els.clampWarn.classList.toggle('on', !!warn);

    els.sale.textContent = money(c.list);
    els.capWarn.classList.toggle('on', c.capped);

    els.max.textContent = money(c.max);
    els.result.classList.toggle('neg', c.max < 0);

    els.maxNote.textContent = c.sale > 0
      ? (c.days ? `To sell in ~${c.days} days` : 'Enter MDS or days to sell for a timeframe') +
        (c.capped ? ' · priced at the bank cap' : ` · priced at ${fmtPct(c.sellPct)} of market`)
      : '';

    els.mini.textContent = money(c.max);
  }

  function noteText() {
    const c = compute();
    const date = new Date().toLocaleDateString('en-US');
    const parts = [`MAX BUY: ${money(c.max)}`];
    if (c.days) parts.push(`Sell in ~${c.days} days`);
    parts.push(
      `List ${money(c.list)}` +
        (c.capped ? ' (bank cap)' : ` (${fmtPct(c.sellPct)} of mkt)`)
    );
    if (c.cleanTrade) parts.push(`JDP CT ${money(c.cleanTrade)} x125% = ${money(c.ceiling)}`);
    if (c.market) parts.push(`Mkt ${money(c.market)}`);
    if (c.mds) parts.push(`MDS ${Math.round(c.mds)}`);
    parts.push(
      `Profit ${money(c.profit)}`,
      `Transport ${money(c.transport)}`,
      `Buy Fee ${money(c.buyFee)}`,
      `Recon ${money(c.recon)}`,
      date
    );
    return parts.join(' | ');
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
    // Collapsed: dock the bar to the bottom of the window (same left/right spot).
    // Expanded: go back to where it was dragged to.
    if (state.collapsed) {
      p.style.top = 'auto';
      p.style.bottom = '16px';
    } else {
      p.style.top = clamp(top, 0, window.innerHeight - 40) + 'px';
      p.style.bottom = 'auto';
    }
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
        // While docked at the bottom, dragging only moves it sideways.
        top: state.collapsed ? state.pos.top : start.top + e.clientY - start.y,
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

  chrome.storage.local.get(['values', 'opacity', 'pos', 'collapsed']).then(async (s) => {
    state.values = s.values ?? {};
    state.opacity = s.opacity ?? 0.8;
    state.pos = s.pos ?? state.pos;
    state.collapsed = s.collapsed ?? false;
    const res = await chrome.runtime.sendMessage({ type: 'getVisible' }).catch(() => null);
    setVisible(!!res?.visible);
  });

  // Show/hide for this tab only, driven by the background worker.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'setVisible') setVisible(!!msg.visible);
  });

  // Pick up values typed into the calculator on another tab.
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (ch.values && root) {
      state.values = ch.values.newValue ?? {};
      for (const key of KEYS) {
        const input = els.inputs[key];
        if (input !== input.getRootNode().activeElement) input.value = state.values[key] ?? '';
      }
      render();
    }
  });

  window.addEventListener('resize', () => root && applyLayout());
})();
