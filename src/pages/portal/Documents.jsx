import { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { api } from '../../lib/api';
import { dateTime, money, shortDate } from '../../lib/format';
import { STAGE_LABELS } from '../../lib/stages';

const TYPE_LABELS = {
  inspection: 'Inspection',
  estimate: 'Estimate',
  invoice: 'Invoice',
  delivery_record: 'Delivery record',
};

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

  function load() {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (q) params.set('q', q);
    api.get(`/documents?${params.toString()}`).then((data) => setDocuments(data.documents));
  }

  useEffect(load, [type, q]);

  async function open(doc) {
    const data = await api.get(`/documents/${doc.id}`);
    setSelected(data);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-3">Documents</h1>
      <div className="flex gap-2 mb-4">
        <select value={type} onChange={(e) => setType(e.target.value)} className="text-sm border border-slate-300 rounded-md px-2 py-1.5">
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          placeholder="Search VIN or stock #"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="text-sm border border-slate-300 rounded-md px-2 py-1.5 flex-1"
        />
      </div>

      <div className="space-y-2">
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => open(doc)}
            className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3 text-left hover:border-slate-300"
          >
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-slate-400" />
              <div>
                <div className="text-sm font-medium text-slate-900">{doc.title || TYPE_LABELS[doc.type]}</div>
                <div className="text-xs text-slate-500">
                  {[doc.year, doc.make, doc.model].filter(Boolean).join(' ')} · {doc.vin} · Stock #{doc.stock_number || '—'}
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-400">{dateTime(doc.created_at)}</div>
          </button>
        ))}
        {documents.length === 0 ? <div className="text-sm text-slate-400">No documents found.</div> : null}
      </div>

      {selected ? <DocumentModal doc={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function DocumentModal({ doc, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900">{doc.document.title || TYPE_LABELS[doc.document.type]}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
        <DocumentContent doc={doc} />
      </div>
    </div>
  );
}

function DocumentContent({ doc }) {
  const { document: meta, content } = doc;
  if (!content) return <div className="text-sm text-slate-400">This document's underlying record could not be found.</div>;

  if (meta.type === 'estimate') {
    const lines = content.snapshot?.lines || [];
    const total = lines.reduce((sum, l) => sum + (l.total_price_cents || l.totalPriceCents || 0), 0);
    return (
      <div>
        <div className="text-xs text-slate-500 mb-2">
          {content.kind === 'sent' ? `Version ${content.version}` : `Dealer decision — version ${content.version}`} ·{' '}
          {dateTime(content.created_at)}
        </div>
        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm">
              <div>
                <div className="text-slate-900">{l.title}</div>
                <div className="text-xs text-slate-500">
                  {l.approval_status} · {STAGE_LABELS[l.stage] || l.stage}
                </div>
              </div>
              <div className="text-slate-700 font-medium">{money(l.total_price_cents)}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm font-semibold mt-3 pt-2 border-t border-slate-200">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
      </div>
    );
  }

  if (meta.type === 'inspection') {
    return (
      <div className="space-y-3">
        <div className="text-xs text-slate-500">Completed {dateTime(content.completed_at)}</div>
        {content.findings?.length > 0 ? (
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Findings</div>
            <ul className="text-sm text-slate-700 space-y-2">
              {content.findings.map((f, i) => (
                <li key={i}>
                  <div>
                    {f.title} <span className="text-xs text-slate-400">({f.severity})</span>
                  </div>
                  {f.photos?.length > 0 ? (
                    <div className="flex gap-1 mt-1">
                      {f.photos.map((src, j) => (
                        <img key={j} src={src} alt="" className="w-14 h-14 object-cover rounded border border-slate-200" />
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-sm text-slate-400">No findings recorded.</div>
        )}
        {content.checklist?.length > 0 ? (
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Checklist</div>
            <ul className="text-sm text-slate-700 space-y-0.5">
              {content.checklist.map((c, i) => (
                <li key={i}>
                  {c.passed ? '✓' : '✗'} {c.item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  if (meta.type === 'invoice') {
    return (
      <div className="space-y-1 text-sm">
        <Row label="Subtotal" value={money(content.subtotal_cents)} />
        <Row label="Tax" value={money(content.tax_cents)} />
        <Row label="Total" value={money(content.total_cents)} strong />
        <Row label="Status" value={content.status} />
        {content.sent_at ? <Row label="Sent" value={shortDate(content.sent_at)} /> : null}
        {content.paid_at ? <Row label="Paid" value={shortDate(content.paid_at)} /> : null}
      </div>
    );
  }

  if (meta.type === 'delivery_record') {
    return (
      <div className="space-y-1 text-sm">
        <Row label="Status" value={content.status?.replace('_', ' ')} />
        <Row label="Promised" value={shortDate(content.promised_at)} />
        <Row label="Delivered" value={shortDate(content.delivered_at)} />
      </div>
    );
  }

  return <div className="text-sm text-slate-400">Unknown document type.</div>;
}

function Row({ label, value, strong }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-semibold border-t border-slate-200 pt-1 mt-1' : ''}`}>
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}
