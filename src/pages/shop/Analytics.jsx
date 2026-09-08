import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../../lib/api';
import { money, shortDate } from '../../lib/format';
import { CATEGORY_LABELS } from '../../lib/laborGuide';

// Reference palette (see the dataviz skill) — fixed categorical order,
// never cycled or reassigned by filter state.
const COLOR_BLUE = '#2a78d6';
const COLOR_ORANGE = '#eb6834';
const COLOR_AQUA = '#1baf7a';
const INK_SECONDARY = '#52514e';
const GRID = '#e1e0d9';

const SCOPES = [
  { value: 'all', label: 'All' },
  { value: 'customer', label: 'Customer-pay' },
  { value: 'internal', label: 'Internal' },
];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [scope, setScope] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/analytics/summary?scope=${scope}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [scope]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!data) return <div className="text-sm text-slate-400">Loading…</div>;

  const cycleTimeData = data.cycleTimeByWeek.map((w) => ({
    ...w,
    weekLabel: shortDate(w.week),
    touch: round1(w.touch),
    approvalWait: round1(w.approvalWait),
    partsWait: round1(w.partsWait),
  }));

  const throughputData = data.throughputByWeek.map((w) => ({ weekLabel: shortDate(w.week), delivered: w.delivered }));

  const approvalRateData = data.approvalRateByCategory.map((c) => ({
    category: CATEGORY_LABELS[c.category] || c.category,
    ratePct: Math.round(c.rate * 100),
    approved: c.approved,
    decided: c.decided,
  }));

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
        <div className="flex gap-1 bg-slate-100 rounded-md p-0.5">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              onClick={() => setScope(s.value)}
              className={`text-xs px-2.5 py-1 rounded ${scope === s.value ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <ChartCard title="Cycle time decomposition" subtitle="Hours per week — shop touch time vs. dealer approval wait vs. parts wait">
        {cycleTimeData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cycleTimeData}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="weekLabel" tick={{ fill: INK_SECONDARY, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis tick={{ fill: INK_SECONDARY, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} label={{ value: 'hours', angle: -90, position: 'insideLeft', fill: INK_SECONDARY, fontSize: 12 }} />
              <Tooltip formatter={(v) => `${v}h`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="touch" name="Shop touch" stackId="a" fill={COLOR_BLUE} radius={[0, 0, 0, 0]} />
              <Bar dataKey="approvalWait" name="Dealer approval wait" stackId="a" fill={COLOR_ORANGE} />
              <Bar dataKey="partsWait" name="Parts wait" stackId="a" fill={COLOR_AQUA} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Throughput" subtitle="Vehicles delivered per week">
        {throughputData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={throughputData}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="weekLabel" tick={{ fill: INK_SECONDARY, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: INK_SECONDARY, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} />
              <Tooltip />
              <Bar dataKey="delivered" name="Delivered" fill={COLOR_BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Approval rate by job category" subtitle="Share of decided lines the dealer approved">
        {approvalRateData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(approvalRateData.length * 40, 120)}>
            <BarChart data={approvalRateData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: INK_SECONDARY, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} unit="%" />
              <YAxis type="category" dataKey="category" tick={{ fill: INK_SECONDARY, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} width={110} />
              <Tooltip formatter={(v, _n, entry) => [`${v}% (${entry.payload.approved}/${entry.payload.decided})`, 'Approval rate']} />
              <Bar dataKey="ratePct" name="Approval rate" fill={COLOR_BLUE} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Per-dealer" subtitle="Revenue, average cycle time, average approval response time">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-xs uppercase border-b border-slate-200">
              <tr>
                <th className="text-left py-2 pr-4">Dealer</th>
                <th className="text-right py-2 pr-4">Revenue</th>
                <th className="text-right py-2 pr-4">Avg cycle time</th>
                <th className="text-right py-2">Avg approval response</th>
              </tr>
            </thead>
            <tbody>
              {data.dealerTable.map((d) => (
                <tr key={d.dealerId} className="border-b border-slate-100">
                  <td className="py-2 pr-4">
                    {d.dealerName}
                    {d.isInternal ? <span className="text-xs text-slate-400"> · internal</span> : null}
                  </td>
                  <td className="py-2 pr-4 text-right">{money(d.revenueCents)}</td>
                  <td className="py-2 pr-4 text-right">{d.avgCycleDays != null ? `${d.avgCycleDays.toFixed(1)}d` : '—'}</td>
                  <td className="py-2 text-right">{d.avgApprovalResponseHours != null ? `${d.avgApprovalResponseHours.toFixed(1)}h` : '—'}</td>
                </tr>
              ))}
              {data.dealerTable.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No data yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

function round1(n) {
  return Math.round((n || 0) * 10) / 10;
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 mb-3">{subtitle}</p>
      {children}
    </div>
  );
}

function EmptyState() {
  return <div className="text-sm text-slate-400 py-8 text-center">Not enough data yet.</div>;
}
