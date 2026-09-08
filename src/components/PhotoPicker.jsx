import { Camera, X } from 'lucide-react';

/**
 * Lightweight photo capture: reads local files as base64 data URLs and
 * stores them directly in the photos jsonb column. Fine for Phase 1 demo
 * volumes; swap for real object storage (e.g. Vercel Blob) before scaling.
 */
export default function PhotoPicker({ photos, onChange, label = 'Add photos' }) {
  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
          })
      )
    ).then((dataUrls) => onChange([...photos, ...dataUrls]));
    e.target.value = '';
  }

  function removeAt(idx) {
    onChange(photos.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label className="inline-flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 rounded-md px-3 py-1.5 cursor-pointer hover:bg-slate-50">
        <Camera size={14} /> {label}
        <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      </label>
      {photos.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {photos.map((src, idx) => (
            <div key={idx} className="relative w-16 h-16">
              <img src={src} alt="" className="w-16 h-16 object-cover rounded-md border border-slate-200" />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full w-4 h-4 flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
