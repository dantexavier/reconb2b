export async function decodeVin(vin) {
  const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`);
  if (!res.ok) throw new Error('VIN decode failed');
  const data = await res.json();
  const results = data.Results || [];
  const get = (name) => {
    const row = results.find((r) => r.Variable === name);
    return row && row.Value && row.Value !== 'Not Applicable' ? row.Value : null;
  };
  return {
    year: get('Model Year') ? Number(get('Model Year')) : null,
    make: get('Make'),
    model: get('Model'),
    trim: get('Trim'),
  };
}
