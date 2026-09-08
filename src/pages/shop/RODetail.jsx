import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Send, FileText, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { money, shortDate, dateTime } from '../../lib/format';
import { PIPELINE_STAGES, STAGE_LABELS } from '../../lib/stages';
import { TimeInStageBadge, BlockedBadge, ApprovalStatusBadge } from '../../components/Badges';
import PhotoPicker from '../../components/PhotoPicker';

export default function RODetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [techs, setTechs] = useState([]);
  const [error, setError] = useState('');
  const [newLine, setNewLine] = useState({ title: '', laborHours: 0, partsCostCents: 0 });
  const [inspection, setInspection] = useState({ findings: [], photos: [] });
  const [findingDraft, setFindingDraft] = useState({ title: '', severity: 'minor' });

  const load = useCallback(() => {
    api.get(`/recon-orders/${id}`).then(setData).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
    api.get('/users').then((d) => setTechs(d.users.filter((u) => u.role === 'tech'))).catch(() => {});
  }, [load]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!data) return <div className="text-sm text-slate-400">Loading…</div>;

  const { reconOrder: ro, lines, inspections, snapshots, invoices, comebackLines } = data;
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
    });
    setNewLine({ title: '', laborHours: 0, partsCostCents: 0 });
    load();
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
    setFindingDraft({ title: '', severity: 'minor' });
  }

  async function submitInspection() {
    await api.post('/inspections', {
      roId: id,
      findings: inspection.findings,
      checklist: [],
    });
    setInspection({ findings: [], photos: [] });
    load();
  }

  const vehicleLabel = [ro.year, ro.make, ro.model, ro.trim].filter(Boolean).join(' ');
  const pendingLines = lines.filter((l) => l.approval_status === 'pending');

  return (
    <div className="max-w-5xl space-y-6">
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

        <form onSubmit={addLine} className="flex items-center gap-2 mt-3 flex-wrap">
          <input
            required
            placeholder="Line title"
            value={newLine.title}
            onChange={(e) => setNewLine((l) => ({ ...l, title: e.target.value }))}
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
            placeholder="Parts cost ¢"
            value={newLine.partsCostCents}
            onChange={(e) => setNewLine((l) => ({ ...l, partsCostCents: e.target.value }))}
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
          {inspection.findings.length > 0 ? (
            <ul className="text-sm text-slate-700 list-disc list-inside">
              {inspection.findings.map((f, i) => (
                <li key={i}>
                  {f.title} <span className="text-xs text-slate-400">({f.severity})</span>
                </li>
              ))}
            </ul>
          ) : null}
          <PhotoPicker photos={inspection.photos} onChange={(photos) => setInspection((i) => ({ ...i, photos }))} label="Add finding photos" />
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
