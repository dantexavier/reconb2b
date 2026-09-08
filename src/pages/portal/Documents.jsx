import { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { api } from '../../lib/api';
import { dateTime } from '../../lib/format';

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
        <pre className="text-xs bg-slate-50 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(doc.content, null, 2)}
        </pre>
      </div>
    </div>
  );
}
