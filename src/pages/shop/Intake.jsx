import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ScanLine } from 'lucide-react';
import { api } from '../../lib/api';
import { decodeVin } from '../../lib/vin';
import PhotoPicker from '../../components/PhotoPicker';

const LINE_PACKAGES = {
  custom: { label: 'Custom line', laborHours: 0 },
  full_detail: { label: 'Full detail', laborHours: 3 },
  mechanical_inspection: { label: 'Mechanical inspection', laborHours: 1.5 },
  paint_correction: { label: 'Paint correction', laborHours: 4 },
};

export default function Intake() {
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [dealerId, setDealerId] = useState('');
  const [vin, setVin] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [vehicle, setVehicle] = useState({ year: '', make: '', model: '', trim: '', stockNumber: '', color: '', odometer: '' });
  const [photos, setPhotos] = useState([]);
  const [lines, setLines] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdRO, setCreatedRO] = useState(null);

  useEffect(() => {
    api.get('/dealers').then((data) => {
      setDealers(data.dealers);
      if (data.dealers[0]) setDealerId(data.dealers[0].id);
    });
  }, []);

  const selectedDealer = dealers.find((d) => d.id === dealerId);

  async function handleDecode() {
    if (vin.length !== 17) {
      setError('VIN must be 17 characters');
      return;
    }
    setError('');
    setDecoding(true);
    try {
      const decoded = await decodeVin(vin);
      setVehicle((v) => ({ ...v, ...Object.fromEntries(Object.entries(decoded).filter(([, val]) => val != null)) }));
    } catch {
      setError('VIN decode failed — enter details manually');
    } finally {
      setDecoding(false);
    }
  }

  function addLine(packageKey) {
    const pkg = LINE_PACKAGES[packageKey];
    setLines((ls) => [
      ...ls,
      { title: pkg.label, laborHours: pkg.laborHours, laborRateCents: selectedDealer?.labor_rate_cents || 12000, partsCostCents: 0, partsPriceCents: 0 },
    ]);
  }

  function updateLine(idx, patch) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx) {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!dealerId || vin.length !== 17) {
      setError('Dealer and a valid 17-character VIN are required');
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.post('/recon-orders', {
        dealerId,
        vin,
        ...vehicle,
        year: vehicle.year ? Number(vehicle.year) : null,
        odometer: vehicle.odometer ? Number(vehicle.odometer) : null,
        photos,
        lines,
      });
      setCreatedRO(data.reconOrder);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (createdRO) {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-slate-900 mb-4">RO created</h1>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-sm text-slate-500">Computed promise date</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1">
            {createdRO.promised_at ? new Date(createdRO.promised_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'Pending lines'}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Based on current shop capacity and queue. Recalculates automatically as approvals and parts come in.
          </p>
          <button
            onClick={() => navigate(`/shop/ro/${createdRO.id}`)}
            className="mt-4 w-full bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-800"
          >
            Continue to RO
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-4">New Intake</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Dealer">
          <select
            value={dealerId}
            onChange={(e) => setDealerId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.is_internal ? '(internal)' : ''}
              </option>
            ))}
          </select>
        </Section>

        <Section title="VIN">
          <div className="flex gap-2">
            <input
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              maxLength={17}
              placeholder="17-character VIN"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
            />
            <button
              type="button"
              onClick={handleDecode}
              disabled={decoding}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-md text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <ScanLine size={14} /> {decoding ? 'Decoding…' : 'Decode'}
            </button>
          </div>
        </Section>

        <Section title="Vehicle details">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Year" value={vehicle.year} onChange={(v) => setVehicle((s) => ({ ...s, year: v }))} />
            <Field label="Make" value={vehicle.make} onChange={(v) => setVehicle((s) => ({ ...s, make: v }))} />
            <Field label="Model" value={vehicle.model} onChange={(v) => setVehicle((s) => ({ ...s, model: v }))} />
            <Field label="Trim" value={vehicle.trim} onChange={(v) => setVehicle((s) => ({ ...s, trim: v }))} />
            <Field label="Stock #" value={vehicle.stockNumber} onChange={(v) => setVehicle((s) => ({ ...s, stockNumber: v }))} />
            <Field label="Color" value={vehicle.color} onChange={(v) => setVehicle((s) => ({ ...s, color: v }))} />
            <Field label="Odometer" value={vehicle.odometer} onChange={(v) => setVehicle((s) => ({ ...s, odometer: v }))} />
          </div>
        </Section>

        <Section title="Photos">
          <PhotoPicker photos={photos} onChange={setPhotos} />
        </Section>

        <Section title="Lines">
          <div className="flex gap-2 mb-3 flex-wrap">
            {Object.entries(LINE_PACKAGES).map(([key, pkg]) => (
              <button
                type="button"
                key={key}
                onClick={() => addLine(key)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50"
              >
                <Plus size={12} /> {pkg.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white border border-slate-200 rounded-md p-2">
                <input
                  value={line.title}
                  onChange={(e) => updateLine(idx, { title: e.target.value })}
                  className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                />
                <input
                  type="number"
                  step="0.25"
                  value={line.laborHours}
                  onChange={(e) => updateLine(idx, { laborHours: Number(e.target.value) })}
                  className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                  title="Labor hours"
                />
                <span className="text-xs text-slate-400">hrs</span>
                <button type="button" onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {lines.length === 0 ? <div className="text-xs text-slate-400">No lines yet — add a package or build the estimate after intake.</div> : null}
          </div>
        </Section>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <button
          type="submit"
          disabled={submitting}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create RO'}
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-700 mb-2">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
      />
    </div>
  );
}
