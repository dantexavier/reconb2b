import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { PIPELINE_STAGES, STAGE_LABELS } from '../../lib/stages';
import { TimeInStageBadge, BlockedBadge } from '../../components/Badges';

export default function TechView() {
  const { user } = useAuth();
  const [lines, setLines] = useState([]);
  const [blockingId, setBlockingId] = useState(null);

  const load = useCallback(() => {
    api.get(`/ro-lines?techId=${user.id}`).then((data) => setLines(data.lines));
  }, [user.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [load]);

  async function advance(line) {
    const idx = PIPELINE_STAGES.indexOf(line.stage);
    const next = PIPELINE_STAGES[idx + 1];
    if (!next) return;
    await api.patch(`/ro-lines/${line.id}`, { stage: next, blockedReason: null });
    load();
  }

  async function setBlocked(line, reason) {
    await api.patch(`/ro-lines/${line.id}`, { blockedReason: reason });
    setBlockingId(null);
    load();
  }

  return (
    <div className="max-w-md mx-auto space-y-3">
      <h1 className="text-xl font-semibold text-slate-900">My Lines</h1>
      {lines.length === 0 ? <div className="text-sm text-slate-400">No lines assigned right now.</div> : null}
      {lines.map((line) => {
        const vehicleLabel = [line.year, line.make, line.model].filter(Boolean).join(' ') || line.stock_number;
        return (
          <div key={line.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-base font-semibold text-slate-900">{vehicleLabel}</div>
            <div className="text-sm text-slate-500">{line.dealer_name}</div>
            <div className="text-sm text-slate-700 mt-1">{line.title}</div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">{STAGE_LABELS[line.stage]}</span>
              <TimeInStageBadge stage={line.stage} stageEnteredAt={line.stage_entered_at} />
              <BlockedBadge blockedReason={line.blocked_reason} />
            </div>

            {blockingId === line.id ? (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {['parts', 'approval', 'sublet', 'payment'].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setBlocked(line, reason)}
                    className="py-3 rounded-lg border border-amber-300 text-amber-800 bg-amber-50 text-sm font-medium capitalize"
                  >
                    {reason}
                  </button>
                ))}
                <button onClick={() => setBlockingId(null)} className="col-span-2 py-2 text-xs text-slate-400">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => advance(line)}
                  disabled={line.stage === 'ready'}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-40"
                >
                  Advance <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => setBlockingId(line.id)}
                  className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-lg border border-amber-300 text-amber-700 text-sm font-medium"
                >
                  <AlertTriangle size={16} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
