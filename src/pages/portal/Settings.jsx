import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const EVENT_LABELS = {
  estimate_ready: 'Estimate ready for review',
  approval_needed: 'Approval needed',
  approval_reminder: 'Approval reminder',
  promise_date_changed: 'Promise date changed',
  qc_passed: 'QC passed',
  ready_for_pickup: 'Ready for pickup',
  invoice_sent: 'Invoice sent',
};

export default function Settings() {
  const [prefs, setPrefs] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/alert-prefs').then((data) => setPrefs(data.prefs));
  }, []);

  function toggle(eventType, channel) {
    setPrefs((ps) => ps.map((p) => (p.eventType === eventType && p.channel === channel ? { ...p, enabled: !p.enabled } : p)));
  }

  async function save() {
    await api.put('/alert-prefs', { prefs });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const eventTypes = Object.keys(EVENT_LABELS);

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-slate-900 mb-3">Alert settings</h1>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Event</th>
              <th className="px-3 py-2">SMS</th>
              <th className="px-3 py-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {eventTypes.map((eventType) => (
              <tr key={eventType} className="border-t border-slate-100">
                <td className="px-3 py-2">{EVENT_LABELS[eventType]}</td>
                {['sms', 'email'].map((channel) => {
                  const pref = prefs.find((p) => p.eventType === eventType && p.channel === channel);
                  return (
                    <td key={channel} className="px-3 py-2 text-center">
                      <input type="checkbox" checked={pref?.enabled ?? true} onChange={() => toggle(eventType, channel)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={save} className="mt-3 bg-slate-900 text-white text-sm px-4 py-2 rounded-md">
        {saved ? 'Saved ✓' : 'Save preferences'}
      </button>
    </div>
  );
}
