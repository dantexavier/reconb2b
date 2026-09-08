import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../../lib/api';
import { money, shortDate } from '../../lib/format';

export default function History() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api.get('/recon-orders?status=delivered').then((data) => setOrders(data.reconOrders));
  }, []);

  const withCycleTime = orders.map((ro) => ({
    ...ro,
    cycleDays: ro.delivered_at ? (new Date(ro.delivered_at) - new Date(ro.created_at)) / 86400000 : null,
  }));
  const avgCycle =
    withCycleTime.length > 0
      ? withCycleTime.reduce((sum, ro) => sum + (ro.cycleDays || 0), 0) / withCycleTime.length
      : 0;

  function exportCsv() {
    const header = ['Vehicle', 'VIN', 'Stock #', 'Delivered', 'Cycle days', 'Cost'];
    const rows = withCycleTime.map((ro) => [
      [ro.year, ro.make, ro.model].filter(Boolean).join(' '),
      ro.vin,
      ro.stock_number || '',
      ro.delivered_at ? shortDate(ro.delivered_at) : '',
      ro.cycleDays != null ? ro.cycleDays.toFixed(1) : '',
      money(ro.approved_total_cents),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recon-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold text-slate-900">History</h1>
        <button onClick={exportCsv} className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50">
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="text-sm text-slate-500 mb-3">Average cycle time: {avgCycle.toFixed(1)} days</div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Vehicle</th>
              <th className="text-left px-3 py-2">Delivered</th>
              <th className="text-left px-3 py-2">Cycle time</th>
              <th className="text-left px-3 py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {withCycleTime.map((ro) => (
              <tr key={ro.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{[ro.year, ro.make, ro.model].filter(Boolean).join(' ')}</td>
                <td className="px-3 py-2">{shortDate(ro.delivered_at)}</td>
                <td className="px-3 py-2">{ro.cycleDays != null ? `${ro.cycleDays.toFixed(1)}d` : '—'}</td>
                <td className="px-3 py-2">{money(ro.approved_total_cents)}</td>
              </tr>
            ))}
            {withCycleTime.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  No delivered vehicles yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
