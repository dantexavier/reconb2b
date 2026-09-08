import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { money, dateTime, shortDate } from '../../lib/format';
import { STAGE_LABELS } from '../../lib/stages';
import { ApprovalStatusBadge, BlockedBadge } from '../../components/Badges';

export default function VehicleDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/recon-orders/${id}`).then(setData).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!data) return <div className="text-sm text-slate-400">Loading…</div>;

  const { reconOrder: ro, lines, stageEvents, invoices } = data;
  const vehicleLabel = [ro.year, ro.make, ro.model, ro.trim].filter(Boolean).join(' ');
  const allPhotos = [...(ro.vehicle_photos || []), ...lines.flatMap((l) => l.finding_photos || [])];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{vehicleLabel}</h1>
        <div className="text-sm text-slate-500">
          VIN {ro.vin} · Stock #{ro.stock_number || '—'} · Promised {shortDate(ro.promised_at)}
        </div>
      </div>

      {allPhotos.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Photos</h2>
          <div className="flex flex-wrap gap-2">
            {allPhotos.map((src, i) => (
              <img key={i} src={src} alt="" className="w-24 h-24 object-cover rounded-md border border-slate-200" />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Lines</h2>
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.id} className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-900">{line.title}</div>
                <ApprovalStatusBadge status={line.approval_status} />
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {STAGE_LABELS[line.stage]} · {money(line.total_price_cents)}
              </div>
              <BlockedBadge blockedReason={line.blocked_reason} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Timeline</h2>
        <div className="space-y-1">
          {stageEvents.map((ev) => (
            <div key={ev.id} className="text-xs text-slate-500 flex gap-2">
              <span className="text-slate-400 w-32 shrink-0">{dateTime(ev.created_at)}</span>
              <span>
                {ev.from_stage ? `${STAGE_LABELS[ev.from_stage] || ev.from_stage} → ` : ''}
                {STAGE_LABELS[ev.to_stage] || ev.to_stage}
                {ev.note ? ` — ${ev.note}` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {invoices.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Invoices</h2>
          <div className="space-y-1">
            {invoices.map((inv) => (
              <div key={inv.id} className="text-sm text-slate-600">
                {money(inv.total_cents)} — {inv.status}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
