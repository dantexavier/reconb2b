import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { money, shortDate } from '../../lib/format';

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
};

export default function Invoices() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api.get('/recon-orders').then(async (data) => {
      const withInvoices = await Promise.all(
        data.reconOrders.map(async (ro) => {
          const detail = await api.get(`/recon-orders/${ro.id}`);
          return { ro, invoices: detail.invoices };
        })
      );
      setOrders(withInvoices.filter((o) => o.invoices.length > 0));
    });
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-3">Invoices</h1>
      <div className="space-y-2">
        {orders.flatMap(({ ro, invoices }) =>
          invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3">
              <div>
                <div className="text-sm font-medium text-slate-900">
                  {[ro.year, ro.make, ro.model].filter(Boolean).join(' ') || ro.stock_number}
                </div>
                <div className="text-xs text-slate-500">{inv.sent_at ? shortDate(inv.sent_at) : 'Draft'}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-900">{money(inv.total_cents)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[inv.status]}`}>{inv.status}</span>
              </div>
            </div>
          ))
        )}
        {orders.length === 0 ? <div className="text-sm text-slate-400">No invoices yet.</div> : null}
      </div>
      <p className="text-xs text-slate-400 mt-4">Payment processing (ACH via Stripe) ships in Phase 3 — status shown here is informational only.</p>
    </div>
  );
}
