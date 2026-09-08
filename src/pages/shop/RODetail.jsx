import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Send, FileText, AlertTriangle, ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { money, shortDate, dateTime } from '../../lib/format';
import { PIPELINE_STAGES, STAGE_LABELS } from '../../lib/stages';
import { TimeInStageBadge, BlockedBadge, ApprovalStatusBadge } from '../../components/Badges';
import PhotoPicker from '../../components/PhotoPicker';
import { CATEGORY_LABELS } from '../../lib/laborGuide';

export default function RODetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [techs, setTechs] = useState([]);
  const [error, setError] = useState('');
  const [newLine, setNewLine] = useState({ title: '', laborHours: 0, partsCostCents: 0, laborGuideItemId: null });
  const [laborGuide, setLaborGuide] = useState([]);
  const [inspection, setInspection] = useState({ findings: [] });
  const [findingDraft, setFindingDraft] = useState({ title: '', severity: 'minor', photos: [] });

  const load = useCallback(() => {
    api.get(`/recon-orders/${id}`).then(setData).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
    api.get('/users').then((d) => setTechs(d.users.filter((u) => u.role === 'tech'))).catch(() => {});
    api.get('/labor-guide').then((d) => setLaborGuide(d.items)).catch(() => {});
  }, [load]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!data) return <div className="text-sm text-slate-400">Loading…</div>;

  const { reconOrder: ro, lines, inspections, snapshots, invoices, comebackLines, qcChecks } = data;
  const qcLines = lines.filter((l) => l.stage === 'qc');
  const markupPct = Number(ro.dealer_parts_markup_pct || 0);
  const laborRateCents = Number(ro.dealer_labor_rate_cents || 0);

  async function updateLine(lineId, patch) {
    await api.patch(`/ro-lines/${lineId}`, patch);
    load();
  }

  async function addLine(e) {
    e.preventDefault();
    const partsPriceCents = Math.round(newLine.partsCostCents * (1 + markupPct / 100));
    await api.post('/ro-lines', {
      roId: id,
      title: newLine.title,
      laborHours: Number(newLine.laborHours),
      laborRateCents,
      partsCostCents: Number(newLine.partsCostCents),
      partsPriceCents,
      laborGuideItemId: newLine.laborGuideItemId,
    });
    setNewLine({ title: '', laborHours: 0, partsCostCents: 0, laborGuideItemId: null });
    load();
  }

  function pickGuideItem(itemId) {
    if (!itemId) {
      setNewLine({ title: '', laborHours: 0, partsCostCents: 0, laborGuideItemId: null });
      return;
    }
    const item = laborGuide.find((i) => i.id === itemId);
    if (!item) return;
    setNewLine({
      title: item.title,
      laborHours: Number(item.default_labor_hours),
      partsCostCents: Number(item.default_parts_cost_cents),
      laborGuideItemId: item.id,
    });
  }

  async function sendForApproval() {
    await api.post('/estimates/send', { roId: id });
    load();
  }

  async function generateInvoice() {
    await api.post(`/recon-orders/${id}/invoice`);
    load();
  }

  function addFinding() {
    if (!findingDraft.title) return;
    setInspection((i) => ({ ...i, findings: [...i.findings, findingDraft] }));
    setFindingDraft({ title: '', severity: 'minor', photos: [] });
  }

  async function submitInspection() {
    await api.post('/inspections', {
      roId: id,
      findings: inspection.findings,
      checklist: [],
    });
    setInspection({ findings: [] });
    load();
  }

  const vehicleLabel = [ro.year, ro.make, ro.model, ro.trim].filter(Boolean).join(' ');
  const pendingLines = lines.filter((l) => l.approval_status === 'pending');

  return (
    <div className="max-w-5xl space-y-6">
      <Link to="/shop/board" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={14} /> Back to board
      </Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{vehicleLabel || 'Vehicle'}</h1>
          <div className="text-sm text-slate-500">
            {ro.dealer_name} · {ro.vin} · Stock #{ro.stock_number || '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Promise date</div>
          <div className="text-lg font-semibold text-slate-900">{shortDate(ro.promised_at)}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">{ro.status.replace('_', ' ')}</div>
        </div>
      </div>

      {comebackLines.length > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 items-start">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <div className="font-medium">Previously declined on this VIN</div>
            <ul className="list-disc list-inside">
              {comebackLines.map((c) => (
                <li key={c.id}>{c.title}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <Section title="Lines">
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.id} className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">{line.title}</div>
                  <div className="text-xs text-slate-500">
                    {Number(line.labor_hours)}h × {money(line.labor_rate_cents)} + parts {money(line.parts_price_cents)} ={' '}
                    <span className="font-medium text-slate-700">{money(line.total_price_cents)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ApprovalStatusBadge status={line.approval_status} />
                  <TimeInStageBadge stage={line.stage} stageEnteredAt={line.stage_entered_at} />
                  <BlockedBadge blockedReason={line.blocked_reason} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <select
                  value={line.stage}
                  onChange={(e) => updateLine(line.id, { stage: e.target.value })}
                  className="text-xs border border-slate-300 rounded px-2 py-1"
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </option>
                  ))}
                </select>
                <select
                  value={line.tech_id || ''}
                  onChange={(e) => updateLine(line.id, { techId: e.target.value || null })}
                  className="text-xs border border-slate-300 rounded px-2 py-1"
                >
                  <option value="">Unassigned</option>
                  {techs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  value={line.blocked_reason || ''}
                  onChange={(e) => updateLine(line.id, { blockedReason: e.target.value || null })}
                  className="text-xs border border-slate-300 rounded px-2 py-1"
                >
                  <option value="">Not blocked</option>
                  <option value="parts">Blocked: Parts</option>
                  <option value="approval">Blocked: Approval</option>
                  <option value="sublet">Blocked: Sublet</option>
                  <option value="payment">Blocked: Payment</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <select
            value={newLine.laborGuideItemId || ''}
            onChange={(e) => pickGuideItem(e.target.value)}
            className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
          >
            <option value="">Custom line…</option>
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
              const items = laborGuide.filter((i) => i.category === cat);
              if (items.length === 0) return null;
              return (
                <optgroup key={cat} label={label}>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title} ({Number(i.default_labor_hours)}h)
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
        <form onSubmit={addLine} className="flex items-center gap-2 mt-2 flex-wrap">
          <input
            required
            placeholder="Line title"
            value={newLine.title}
            onChange={(e) => setNewLine((l) => ({ ...l, title: e.target.value, laborGuideItemId: null }))}
            className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm flex-1 min-w-40"
          />
          <input
            type="number"
            step="0.25"
            placeholder="Labor hrs"
            value={newLine.laborHours}
            onChange={(e) => setNewLine((l) => ({ ...l, laborHours: e.target.value }))}
            className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Parts cost $"
            value={newLine.partsCostCents ? (newLine.partsCostCents / 100).toFixed(2) : ''}
            onChange={(e) => setNewLine((l) => ({ ...l, partsCostCents: Math.round(Number(e.target.value) * 100) }))}
            className="w-28 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
          />
          <button type="submit" className="flex items-center gap-1 text-sm px-3 py-1.5 bg-slate-900 text-white rounded-md">
            <Plus size={14} /> Add line
          </button>
        </form>

        {pendingLines.length > 0 ? (
          <button
            onClick={sendForApproval}
            className="mt-3 flex items-center gap-1.5 text-sm px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <Send size={14} /> Send {pendingLines.length} line(s) for approval
          </button>
        ) : null}
      </Section>

      <Section title="Parts orders">
        <PartsOrdersPanel lines={lines} partsOrders={data.partsOrders} onChange={load} />
      </Section>

      {qcLines.length > 0 ? (
        <Section title="QC">
          <QcPanel lines={qcLines} qcChecks={qcChecks} onChange={load} />
        </Section>
      ) : null}

      <Section title="Inspection">
        <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <input
              placeholder="Finding title"
              value={findingDraft.title}
              onChange={(e) => setFindingDraft((f) => ({ ...f, title: e.target.value }))}
              className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
            />
            <select
              value={findingDraft.severity}
              onChange={(e) => setFindingDraft((f) => ({ ...f, severity: e.target.value }))}
              className="text-sm border border-slate-300 rounded-md px-2 py-1.5"
            >
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
            <button type="button" onClick={addFinding} className="text-sm px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50">
              Add finding
            </button>
          </div>
          <PhotoPicker
            photos={findingDraft.photos}
            onChange={(photos) => setFindingDraft((f) => ({ ...f, photos }))}
            label="Add photos to this finding"
          />
          {inspection.findings.length > 0 ? (
            <ul className="text-sm text-slate-700 list-disc list-inside">
              {inspection.findings.map((f, i) => (
                <li key={i}>
                  {f.title} <span className="text-xs text-slate-400">({f.severity}{f.photos?.length ? `, ${f.photos.length} photo(s)` : ''})</span>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            onClick={submitInspection}
            disabled={inspection.findings.length === 0}
            className="text-sm px-3 py-1.5 bg-slate-900 text-white rounded-md disabled:opacity-40"
          >
            Complete inspection
          </button>

          {inspections.length > 0 ? (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              {inspections.map((insp) => (
                <div key={insp.id} className="text-xs text-slate-500">
                  {dateTime(insp.completed_at)} by {insp.tech_name || 'shop'} — {(insp.findings || []).length} finding(s)
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Section>

      <Section title="Estimate versions">
        <div className="space-y-1">
          {snapshots.length === 0 ? <div className="text-sm text-slate-400">No estimate sent yet.</div> : null}
          {snapshots.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm text-slate-600">
              <FileText size={14} />
              {s.kind === 'sent' ? (s.version === 1 ? 'Original estimate' : `Revised estimate v${s.version}`) : `Dealer decision (v${s.version})`}
              <span className="text-xs text-slate-400">{dateTime(s.created_at)}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Invoicing">
        <button onClick={generateInvoice} className="text-sm px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50">
          Generate invoice
        </button>
        <div className="mt-2 space-y-1">
          {invoices.map((inv) => (
            <div key={inv.id} className="text-sm text-slate-600">
              {money(inv.total_cents)} — {inv.status} {inv.sent_at ? `(${shortDate(inv.sent_at)})` : ''}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-700 mb-2">{title}</h2>
      {children}
    </div>
  );
}

const DEFAULT_QC_CHECKLIST = [
  'Exterior clean and presentable',
  'Interior clean and presentable',
  'All lights functioning',
  'Tire pressure checked',
  'Fluids topped off',
  'Test drive completed, no warning lights',
];

function QcPanel({ lines, qcChecks, onChange }) {
  const [checklists, setChecklists] = useState({});

  function getChecklist(lineId) {
    return checklists[lineId] || DEFAULT_QC_CHECKLIST.map((item) => ({ item, passed: false }));
  }

  function toggleItem(lineId, idx) {
    const checklist = getChecklist(lineId).map((c, i) => (i === idx ? { ...c, passed: !c.passed } : c));
    setChecklists((cs) => ({ ...cs, [lineId]: checklist }));
  }

  async function submitQc(lineId, passed) {
    await api.post('/qc-checks', { roLineId: lineId, checklist: getChecklist(lineId), passed });
    setChecklists((cs) => ({ ...cs, [lineId]: undefined }));
    onChange();
  }

  return (
    <div className="space-y-4">
      {lines.map((line) => {
        const checklist = getChecklist(line.id);
        const allChecked = checklist.every((c) => c.passed);
        const priorChecks = qcChecks.filter((c) => c.ro_line_id === line.id);
        return (
          <div key={line.id} className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="text-sm font-medium text-slate-900 mb-2">{line.title}</div>
            <div className="space-y-1 mb-3">
              {checklist.map((c, idx) => (
                <label key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={c.passed} onChange={() => toggleItem(line.id, idx)} />
                  {c.item}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => submitQc(line.id, true)}
                disabled={!allChecked}
                className="text-sm px-3 py-1.5 bg-emerald-600 text-white rounded-md disabled:opacity-40"
              >
                Pass QC
              </button>
              <button onClick={() => submitQc(line.id, false)} className="text-sm px-3 py-1.5 border border-slate-300 rounded-md">
                Fail QC
              </button>
            </div>
            {priorChecks.length > 0 ? (
              <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                Previous attempts: {priorChecks.map((c) => (c.passed ? 'Pass' : 'Fail')).join(', ')}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PartsOrdersPanel({ lines, partsOrders, onChange }) {
  const [draft, setDraft] = useState({ roLineId: '', vendor: '', description: '', costCents: 0, etaDate: '', binLocation: '' });

  async function addOrder(e) {
    e.preventDefault();
    if (!draft.roLineId) return;
    await api.post('/parts-orders', draft);
    setDraft({ roLineId: '', vendor: '', description: '', costCents: 0, etaDate: '', binLocation: '' });
    onChange();
  }

  async function updateStatus(orderId, status) {
    await api.patch(`/parts-orders/${orderId}`, { status });
    onChange();
  }

  const lineTitle = (id) => lines.find((l) => l.id === id)?.title || 'Line';

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {partsOrders.map((po) => (
          <div key={po.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3">
            <div>
              <div className="text-sm font-medium text-slate-900">
                {po.description || 'Part'} — {lineTitle(po.ro_line_id)}
              </div>
              <div className="text-xs text-slate-500">
                {po.vendor || 'Unknown vendor'} · {money(po.cost_cents)}
                {po.eta_date ? ` · ETA ${shortDate(po.eta_date)}` : ''}
                {po.bin_location ? ` · Bin ${po.bin_location}` : ''}
              </div>
            </div>
            <select
              value={po.status}
              onChange={(e) => updateStatus(po.id, e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1"
            >
              <option value="ordered">Ordered</option>
              <option value="received">Received</option>
              <option value="installed">Installed</option>
            </select>
          </div>
        ))}
        {partsOrders.length === 0 ? <div className="text-sm text-slate-400">No parts ordered yet.</div> : null}
      </div>

      <form onSubmit={addOrder} className="flex items-center gap-2 flex-wrap">
        <select
          required
          value={draft.roLineId}
          onChange={(e) => setDraft((d) => ({ ...d, roLineId: e.target.value }))}
          className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
        >
          <option value="">For line…</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
        <input
          placeholder="Vendor"
          value={draft.vendor}
          onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value }))}
          className="w-28 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
        />
        <input
          placeholder="Part description"
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          className="flex-1 min-w-32 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Cost $"
          value={draft.costCents ? draft.costCents / 100 : ''}
          onChange={(e) => setDraft((d) => ({ ...d, costCents: Math.round(Number(e.target.value) * 100) }))}
          className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
        />
        <input
          type="date"
          value={draft.etaDate}
          onChange={(e) => setDraft((d) => ({ ...d, etaDate: e.target.value }))}
          className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
        />
        <input
          placeholder="Bin"
          value={draft.binLocation}
          onChange={(e) => setDraft((d) => ({ ...d, binLocation: e.target.value }))}
          className="w-16 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
        />
        <button type="submit" className="flex items-center gap-1 text-sm px-3 py-1.5 bg-slate-900 text-white rounded-md">
          <Plus size={14} /> Order part
        </button>
      </form>
    </div>
  );
}
