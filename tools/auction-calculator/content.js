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
  // Days to sell = market days supply × the "Sell speed" setting (blank = 100%).
  const DEFAULT_SPEED = 100;

  // Deal grade cutoffs (gross profit per day on the lot; no holding cost yet).
  const GRADE = { A: 60, B: 35, C: 15 }; // $/day
  const A_MAX_COST_TO_MARKET = 0.85; // an A also needs all-in cost ≤ 85% of market
  // ----------------------------------------------------------------------

  const FIELDS = {
    cleanTrade: { label: 'JD Power Clean Trade', perVehicle: true },
    market: { label: 'Market Value', perVehicle: true },
    mds: { label: 'Market Days Supply', perVehicle: true, kind: 'days' },
    speed: { label: 'Sell speed (% of MDS)', kind: 'pct' },
    profit: { label: 'Target Profit' },
    transport: { label: 'Transport' },
    buyFee: { label: 'Buy Fee' },
    recon: { label: 'Est. Recon', perVehicle: true },
    bid: { label: 'Bid / Price', perVehicle: true },
  };
  const KEYS = Object.keys(FIELDS);

  const money = (n) =>
    (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  const pct = (n) => Math.round(n * 100) + '%';

  const parse = (s) => {
    const n = parseFloat(String(s ?? '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const format = (key, s) => {
    const kind = FIELDS[key].kind;
    if (kind === 'days') return String(Math.round(parse(s)));
    if (kind === 'pct') return Math.round(parse(s)) + '%';
    return money(parse(s));
  };
  const PLACEHOLDER = { days: 'days', pct: DEFAULT_SPEED + '%' };

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
    .deal {
      display: grid; grid-template-columns: 52px 1fr; gap: 10px; align-items: center;
      padding: 8px; border-radius: 8px; background: rgba(255,255,255,.05);
      border: 1px solid rgba(148,163,184,.25);
    }
    .grade {
      height: 52px; border-radius: 8px; display: grid; place-items: center;
      font-size: 28px; font-weight: 800; color: #0f172a; background: #475569;
    }
    .grade.small { font-size: 11px; font-weight: 600; color: #cbd5e1; text-align: center; line-height: 1.2; }
    .grade.A { background: #4ade80; } .grade.B { background: #60a5fa; }
    .grade.C { background: #fbbf24; } .grade.D { background: #f87171; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 10px; font-variant-numeric: tabular-nums; }
    .stats div { display: flex; flex-direction: column; }
    .stats span { color: #94a3b8; font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em; }
    .stats b { color: #f1f5f9; font-size: 13px; }
    .stats b.neg { color: #f87171; }
    .dealnote { color: #94a3b8; font-size: 11px; text-align: center; }
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
          ${row('speed')}
          <div class="calc"><span>Sell at</span><b id="sellAt">—</b></div>
          <div class="calc"><span>Est. days to sell</span><b id="daysInfo">—</b></div>
          <div class="calc strong"><span>Expected sale price</span><b id="sale">$0</b></div>
          <div class="warn" id="capWarn">Market is above the bank ceiling: priced at the bank cap.</div>
          <div class="sep"></div>
          ${row('profit')}
          ${row('transport')}
          ${row('buyFee')}
          ${row('recon')}
          <div class="sep"></div>
          <div class="result" id="result"><span>Max Purchase</span><b id="max">$0</b></div>
          <div class="sep"></div>
          ${row('bid')}
          <div class="deal">
            <div class="grade" id="grade">–</div>
            <div class="stats">
              <div><span>Profit</span><b id="dProfit">–</b></div>
              <div><span>Per day</span><b id="dPerDay">–</b></div>
              <div><span>Your cost</span><b id="dCtm">–</b></div>
              <div><span>ROI</span><b id="dRoi">–</b></div>
            </div>
          </div>
          <div class="dealnote" id="dealNote"></div>
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
        ['panel', 'head', 'mini', 'ceiling', 'sellAt', 'daysInfo', 'sale', 'capWarn',
          'max', 'result', 'grade', 'dProfit', 'dPerDay', 'dCtm', 'dRoi', 'dealNote',
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
    const marketPrice = v.market > 0 ? v.market * (band ? band.factor : 1) : 0;

    // Sale price = lower of the bank ceiling and the (MDS-adjusted) market value.
    let sale = 0;
    if (ceiling > 0 && marketPrice > 0) sale = Math.min(ceiling, marketPrice);
    else sale = ceiling || marketPrice;
    const capped = ceiling > 0 && marketPrice > ceiling;

    const costs = v.transport + v.buyFee + v.recon;
    const max = sale - v.profit - costs;

    // Grade the deal at the bid if one is entered, otherwise at the max buy.
    const atBid = v.bid > 0;
    const price = atBid ? v.bid : max;
    const allIn = price + costs;
    const dealProfit = sale - allIn;
    const speed = (parse(state.values.speed) || DEFAULT_SPEED) / 100;
    const days = v.mds > 0 ? Math.max(1, Math.round(v.mds * speed)) : null;
    const perDay = days ? dealProfit / days : null;
    const ctm = v.market > 0 && allIn > 0 ? allIn / v.market : null;
    const roi = allIn > 0 ? dealProfit / allIn : null;

    let grade = null;
    if (sale > 0 && perDay != null) {
      if (dealProfit <= 0) grade = 'D';
      else if (perDay >= GRADE.A && (ctm == null || ctm <= A_MAX_COST_TO_MARKET)) grade = 'A';
      else if (perDay >= GRADE.B) grade = 'B';
      else if (perDay >= GRADE.C) grade = 'C';
      else grade = 'D';
    }

    return { ...v, ceiling, band, sale, capped, costs, max, atBid, price, allIn,
      dealProfit, days, perDay, ctm, roi, grade };
  }

  function render() {
    const c = compute();
    els.ceiling.textContent = money(c.ceiling);
    if (c.band) {
      els.sellAt.textContent = `${pct(c.band.factor)} of market (${c.band.label.toLowerCase()})`;
      els.daysInfo.textContent = `~${c.days} days`;
    } else {
      els.sellAt.textContent = c.market > 0 ? '100% of market' : '—';
      els.daysInfo.textContent = 'enter MDS';
    }
    els.sale.textContent = money(c.sale);
    els.capWarn.classList.toggle('on', c.capped);

    els.max.textContent = money(c.max);
    els.result.classList.toggle('neg', c.max < 0);

    const ready = c.sale > 0;
    els.dProfit.textContent = ready ? money(c.dealProfit) : '–';
    els.dProfit.classList.toggle('neg', ready && c.dealProfit < 0);
    els.dPerDay.textContent = ready && c.perDay != null ? money(c.perDay) + '/day' : '–';
    els.dCtm.textContent = ready && c.ctm != null ? `${pct(c.ctm)} of mkt` : '–';
    els.dRoi.textContent = ready && c.roi != null ? pct(c.roi) : '–';

    els.grade.className = 'grade';
    if (c.grade) {
      els.grade.textContent = c.grade;
      els.grade.classList.add(c.grade);
    } else {
      els.grade.textContent = ready ? 'Add MDS' : '–';
      if (ready) els.grade.classList.add('small');
    }
    els.dealNote.textContent = ready
      ? `Graded at ${c.atBid ? `your bid of ${money(c.price)}` : `the max buy`}` +
        (c.days ? ` · sells in ~${c.days} days` : '')
      : '';

    els.mini.textContent = money(c.max) + (c.grade ? ` · ${c.grade}` : '');
  }

  function noteText() {
    const c = compute();
    const date = new Date().toLocaleDateString('en-US');
    const parts = [`MAX BUY: ${money(c.max)}`];
    if (c.grade) {
      parts.push(
        `Grade ${c.grade} at ${c.atBid ? `bid ${money(c.price)}` : 'max buy'}: ` +
          `profit ${money(c.dealProfit)}, ${money(c.perDay)}/day` +
          (c.ctm != null ? `, cost ${pct(c.ctm)} of mkt` : '') +
          `, ~${c.days} days`
      );
    }
    parts.push(`Sale ${money(c.sale)}${c.capped ? ' (bank cap)' : ''}`);
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
