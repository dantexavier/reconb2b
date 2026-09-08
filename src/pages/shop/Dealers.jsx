import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { DealerTierBadge } from '../../components/Badges';

export default function Dealers() {
  const [dealers, setDealers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newDealer, setNewDealer] = useState({ name: '', contactName: '', contactEmail: '', laborRateCents: 12000, partsMarkupPct: 25 });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  function load() {
    api
      .get('/dealers')
      .then((data) => {
        setDealers(data.dealers);
        if (!selectedId && data.dealers[0]) setSelectedId(data.dealers[0].id);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  const selected = dealers.find((d) => d.id === selectedId);

  async function createDealer(e) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api.post('/dealers', newDealer);
      setShowNew(false);
      setNewDealer({ name: '', contactName: '', contactEmail: '', laborRateCents: 12000, partsMarkupPct: 25 });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex gap-6">
      <div className="w-64 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-semibold text-slate-900">Dealers</h1>
          <button onClick={() => setShowNew((s) => !s)} className="text-slate-500 hover:text-slate-900">
            <Plus size={18} />
          </button>
        </div>
        {showNew ? (
          <form onSubmit={createDealer} className="bg-white border border-slate-200 rounded-lg p-3 mb-3 space-y-2">
            <input
              required
              placeholder="Dealer name"
              value={newDealer.name}
              onChange={(e) => setNewDealer((d) => ({ ...d, name: e.target.value }))}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
            <input
              placeholder="Contact name"
              value={newDealer.contactName}
              onChange={(e) => setNewDealer((d) => ({ ...d, contactName: e.target.value }))}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
            <input
              placeholder="Contact email"
              value={newDealer.contactEmail}
              onChange={(e) => setNewDealer((d) => ({ ...d, contactEmail: e.target.value }))}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
            {error ? <div className="text-xs text-red-600">{error}</div> : null}
            <button type="submit" disabled={creating} className="w-full bg-slate-900 text-white text-sm py-1.5 rounded disabled:opacity-50">
              {creating ? 'Creating…' : 'Create'}
            </button>
          </form>
        ) : null}
        {!showNew && error ? <div className="text-xs text-red-600 mb-2">{error}</div> : null}
        <div className="space-y-1">
          {dealers.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                d.id === selectedId ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              {d.name}
              {d.is_internal ? <span className="text-xs opacity-70"> · internal</span> : null}
            </button>
          ))}
        </div>
      </div>

      {selected ? <DealerDetail key={selected.id} dealer={selected} onUpdated={load} /> : null}
    </div>
  );
}

function DealerDetail({ dealer, onUpdated }) {
  const [form, setForm] = useState({
    name: dealer.name,
    paymentTerms: dealer.payment_terms,
    priorityTier: dealer.priority_tier,
    laborRateCents: dealer.labor_rate_cents,
    partsMarkupPct: dealer.parts_markup_pct,
  });
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'manager', password: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get(`/dealers/${dealer.id}/users`).then((d) => setUsers(d.users));
  }, [dealer.id]);

  async function save(e) {
    e.preventDefault();
    await api.put(`/dealers/${dealer.id}`, form);
    setSaved(true);
    onUpdated();
    setTimeout(() => setSaved(false), 1500);
  }

  async function addUser(e) {
    e.preventDefault();
    await api.post(`/dealers/${dealer.id}/users`, newUser);
    setNewUser({ name: '', email: '', role: 'manager', password: '' });
    const d = await api.get(`/dealers/${dealer.id}/users`);
    setUsers(d.users);
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{dealer.name}</h2>
        <DealerTierBadge tier={dealer.priority_tier} />
      </div>

      <form onSubmit={save} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 max-w-md">
        <h3 className="text-sm font-semibold text-slate-700">Rate card & terms</h3>
        <LabeledInput label="Dealer name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Payment terms</label>
            <select
              value={form.paymentTerms}
              onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
            >
              <option value="prepay">Prepay</option>
              <option value="net15">Net 15</option>
              <option value="net30">Net 30</option>
              <option value="due_on_pickup">Due on pickup</option>
              <option value="accounts_receivable">Accounts receivable</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Priority tier</label>
            <select
              value={form.priorityTier}
              onChange={(e) => setForm((f) => ({ ...f, priorityTier: e.target.value }))}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
            >
              <option value="standard">Standard</option>
              <option value="priority">Priority</option>
            </select>
          </div>
          <LabeledInput
            label="Labor rate ($/hr)"
            type="number"
            step="0.01"
            value={(form.laborRateCents / 100).toFixed(2)}
            onChange={(v) => setForm((f) => ({ ...f, laborRateCents: Math.round(Number(v) * 100) }))}
          />
          <LabeledInput
            label="Parts markup %"
            type="number"
            value={form.partsMarkupPct}
            onChange={(v) => setForm((f) => ({ ...f, partsMarkupPct: Number(v) }))}
          />
        </div>
        <button type="submit" className="bg-slate-900 text-white text-sm px-3 py-1.5 rounded-md">
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-lg p-4 max-w-md">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Users</h3>
        <div className="space-y-1 mb-3">
          {users.map((u) => (
            <div key={u.id} className="text-sm text-slate-600 flex justify-between">
              <span>{u.name}</span>
              <span className="text-xs text-slate-400">{u.role}</span>
            </div>
          ))}
        </div>
        <form onSubmit={addUser} className="space-y-2">
          <input
            required
            placeholder="Name"
            value={newUser.name}
            onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={newUser.email}
            onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
          />
          <input
            required
            type="password"
            placeholder="Temporary password"
            value={newUser.password}
            onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
          />
          <select
            value={newUser.role}
            onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
          >
            <option value="manager">Manager</option>
            <option value="viewer">Viewer</option>
            <option value="billing">Billing</option>
          </select>
          <button type="submit" className="w-full bg-slate-900 text-white text-sm py-1.5 rounded">
            Add user
          </button>
        </form>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = 'text', step }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
      />
    </div>
  );
}
