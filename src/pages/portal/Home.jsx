import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { api } from '../../lib/api';
import { money, shortDate, timeInStageLabel } from '../../lib/format';
import { STAGE_LABELS } from '../../lib/stages';

export default function PortalHome() {
  const [pendingLines, setPendingLines] = useState([]);
  const [orders, setOrders] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);

  const load = useCallback(() => {
    api.get('/ro-lines').then((data) => setPendingLines(data.lines.filter((l) => l.approval_status === 'pending')));
    api.get('/recon-orders').then((data) => setOrders(data.reconOrders.filter((r) => r.status !== 'delivered' && r.status !== 'closed')));
  }, []);

  useEffect(load, [load]);

  async function decide(lineId, action) {
    await api.post(`/ro-lines/${lineId}/${action}`);
    setConfirmingId(null);
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 mb-3">Approval queue</h1>
        {pendingLines.length === 0 ? (
          <div className="text-sm text-slate-400">Nothing awaiting your approval.</div>
        ) : (
          <div className="space-y-3">
            {pendingLines.map((line) => {
              const vehicleLabel = [line.year, line.make, line.model].filter(Boolean).join(' ') || line.stock_number;
              return (
                <div key={line.id} className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{vehicleLabel}</div>
                      <div className="text-sm text-slate-600 mt-0.5">{line.title}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {Number(line.labor_hours)}h labor + parts — <span className="font-semibold text-slate-700">{money(line.total_price_cents)}</span>
                      </div>
                    </div>
                    {(line.finding_photos || []).length > 0 ? (
                      <div className="flex gap-1">
                        {line.finding_photos.slice(0, 3).map((src, i) => (
                          <img key={i} src={src} alt="" className="w-12 h-12 object-cover rounded border border-slate-200" />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {confirmingId === line.id ? (
                    <div className="flex items-center gap-2 mt-3 text-sm">
                      <span className="text-slate-600">Confirm decision?</span>
                      <button onClick={() => decide(line.id, 'approve')} className="px-3 py-1 rounded bg-emerald-600 text-white">
                        Yes, approve
                      </button>
                      <button onClick={() => setConfirmingId(null)} className="px-3 py-1 rounded border border-slate-300">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setConfirmingId(line.id)}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-emerald-600 text-white"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={() => decide(line.id, 'decline')}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-slate-300 text-slate-600"
                      >
                        <X size={14} /> Decline
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900 mb-3">Live board</h1>
        <div className="space-y-2">
          {orders.map((ro) => {
            const vehicleLabel = [ro.year, ro.make, ro.model].filter(Boolean).join(' ') || ro.stock_number;
            const daysInRecon = Math.floor((Date.now() - new Date(ro.created_at).getTime()) / 86400000);
            return (
              <Link
                key={ro.id}
                to={`/portal/vehicle/${ro.id}`}
                className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">{vehicleLabel}</div>
                  <div className="text-xs text-slate-500">
                    {STAGE_LABELS[ro.status] || ro.status.replace('_', ' ')} · {daysInRecon}d in recon
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Promised {shortDate(ro.promised_at)}</div>
                  {ro.oldest_stage_entered_at ? (
                    <div className="text-xs text-slate-400">Stalest line: {timeInStageLabel(ro.oldest_stage_entered_at)}</div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
