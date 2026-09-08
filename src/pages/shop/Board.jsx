import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { PIPELINE_STAGES, STAGE_LABELS } from '../../lib/stages';
import { TimeInStageBadge, BlockedBadge } from '../../components/Badges';

export default function Board() {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/ro-lines')
      .then((data) => setLines(data.lines))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const byStage = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, lines.filter((l) => l.stage === s)]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Board</h1>
        {loading ? <span className="text-xs text-slate-400">Refreshing…</span> : null}
      </div>
      {error ? <div className="text-sm text-red-600 mb-4">{error}</div> : null}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage} className="w-64 shrink-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-sm font-semibold text-slate-700">{STAGE_LABELS[stage]}</h2>
              <span className="text-xs text-slate-400">{byStage[stage].length}</span>
            </div>
            <div className="space-y-2">
              {byStage[stage].map((line) => (
                <LineCard key={line.id} line={line} />
              ))}
              {byStage[stage].length === 0 ? (
                <div className="text-xs text-slate-300 border border-dashed border-slate-200 rounded-md p-3 text-center">
                  Empty
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineCard({ line }) {
  const vehicleLabel = [line.year, line.make, line.model].filter(Boolean).join(' ') || line.stock_number || 'Vehicle';
  return (
    <Link
      to={`/shop/ro/${line.ro_id}`}
      className="block bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 hover:shadow-sm transition-shadow"
    >
      <div className="text-sm font-medium text-slate-900 truncate">{vehicleLabel}</div>
      <div className="text-xs text-slate-500 truncate">{line.dealer_name}</div>
      <div className="text-xs text-slate-600 mt-1 truncate">{line.title}</div>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className="text-xs text-slate-500">{Number(line.labor_hours)}h</span>
        <TimeInStageBadge stage={line.stage} stageEnteredAt={line.stage_entered_at} />
        <BlockedBadge blockedReason={line.blocked_reason} />
        {line.tech_name ? <span className="text-xs text-slate-400">· {line.tech_name}</span> : null}
      </div>
    </Link>
  );
}
