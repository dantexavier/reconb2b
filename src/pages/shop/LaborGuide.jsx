import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { CATEGORY_LABELS } from '../../lib/laborGuide';

const emptyDraft = { title: '', category: 'mechanical', defaultLaborHours: 1, defaultPartsCostCents: 0, description: '' };

export default function LaborGuide() {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [showNew, setShowNew] = useState(false);

  function load() {
    api.get('/labor-guide?includeInactive=true').then((data) => setItems(data.items));
  }

  useEffect(load, []);

  async function createItem(e) {
    e.preventDefault();
    await api.post('/labor-guide', draft);
    setDraft(emptyDraft);
    setShowNew(false);
    load();
  }

  async function updateItem(id, patch) {
    await api.put(`/labor-guide/${id}`, patch);
    load();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Labor Guide</h1>
          <p className="text-sm text-slate-500">Canned jobs advisors pick from during intake and estimate building.</p>
        </div>
        <button
          onClick={() => setShowNew((s) => !s)}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-slate-900 text-white rounded-md"
        >
          <Plus size={14} /> New item
        </button>
      </div>

      {showNew ? (
        <form onSubmit={createItem} className="bg-white border border-slate-200 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Title</label>
              <input
                required
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Category</label>
              <select
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Default labor hours</label>
              <input
                type="number"
                step="0.25"
                value={draft.defaultLaborHours}
                onChange={(e) => setDraft((d) => ({ ...d, defaultLaborHours: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Default parts cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={draft.defaultPartsCostCents / 100}
                onChange={(e) => setDraft((d) => ({ ...d, defaultPartsCostCents: Math.round(Number(e.target.value) * 100) }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
          <button type="submit" className="bg-slate-900 text-white text-sm px-3 py-1.5 rounded-md">
            Create
          </button>
        </form>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Title</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Hours</th>
              <th className="text-left px-3 py-2">Parts cost</th>
              <th className="text-left px-3 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{item.title}</td>
                <td className="px-3 py-2 text-slate-500">{CATEGORY_LABELS[item.category]}</td>
                <td className="px-3 py-2">{Number(item.default_labor_hours)}h</td>
                <td className="px-3 py-2">{money(item.default_parts_cost_cents)}</td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={(e) => updateItem(item.id, { active: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  No labor guide items yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
