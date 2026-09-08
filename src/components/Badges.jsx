import { hoursSince, timeInStageLabel } from '../lib/format';
import { isStale, BLOCKED_REASON_LABELS, blockedOwner } from '../lib/stages';

export function TimeInStageBadge({ stage, stageEnteredAt }) {
  const hours = hoursSince(stageEnteredAt);
  const stale = isStale(stage, hours);
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
        stale ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {timeInStageLabel(stageEnteredAt)}
    </span>
  );
}

export function BlockedBadge({ blockedReason }) {
  if (!blockedReason) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
      Blocked: {BLOCKED_REASON_LABELS[blockedReason] || blockedReason} ({blockedOwner(blockedReason)})
    </span>
  );
}

export function ApprovalStatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-700',
    declined: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export function DealerTierBadge({ tier }) {
  if (tier !== 'priority') return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">
      Priority
    </span>
  );
}
