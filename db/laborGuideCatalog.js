/**
 * Default labor guide catalog — shop-defined default hours/parts costs for
 * common recon operations, seeded once and editable afterward from
 * /shop/labor-guide.
 *
 * These are NOT licensed MOTOR/Mitchell1 flat-rate times — they're
 * reasonable shop defaults to seed the catalog with so advisors aren't
 * starting from zero. If/when Grid Auto Recon licenses real MOTOR data
 * (a paid, vendor-specific integration — see README), the intended seam is
 * a sync job that upserts into the same `labor_guide_items` table (matched
 * by title, or a new `motor_operation_code` column) rather than replacing
 * this file — this stays the fallback/manually-curated set either way.
 */
module.exports = [
  // Mechanical
  { title: 'Mechanical inspection (used vehicle)', category: 'mechanical', hours: 1.5, parts: 0 },
  { title: 'Oil change + multi-point inspection', category: 'mechanical', hours: 0.75, parts: 4500 },
  { title: 'Battery replacement', category: 'mechanical', hours: 0.5, parts: 12000 },
  { title: 'Battery terminal / cable repair', category: 'mechanical', hours: 0.75, parts: 2000 },
  { title: 'Alternator replacement', category: 'mechanical', hours: 2.5, parts: 18000 },
  { title: 'Starter replacement', category: 'mechanical', hours: 2, parts: 15000 },
  { title: 'Brake pad replacement (front)', category: 'mechanical', hours: 1.5, parts: 6000 },
  { title: 'Brake pad replacement (rear)', category: 'mechanical', hours: 1.5, parts: 6000 },
  { title: 'Brake pad + rotor replacement (front)', category: 'mechanical', hours: 2.5, parts: 15000 },
  { title: 'Brake fluid flush', category: 'mechanical', hours: 0.75, parts: 1500 },
  { title: 'Tire replacement (each)', category: 'mechanical', hours: 0.4, parts: 12000 },
  { title: 'Tire rotation + balance', category: 'mechanical', hours: 0.5, parts: 0 },
  { title: 'Wheel alignment', category: 'mechanical', hours: 1, parts: 0 },
  { title: 'Serpentine belt replacement', category: 'mechanical', hours: 1, parts: 4000 },
  { title: 'Timing belt replacement', category: 'mechanical', hours: 4, parts: 25000 },
  { title: 'Water pump replacement', category: 'mechanical', hours: 2.5, parts: 12000 },
  { title: 'Radiator replacement', category: 'mechanical', hours: 2, parts: 18000 },
  { title: 'Coolant flush', category: 'mechanical', hours: 1, parts: 3000 },
  { title: 'Transmission fluid service', category: 'mechanical', hours: 1.5, parts: 8000 },
  { title: 'Struts/shocks replacement (pair)', category: 'mechanical', hours: 3, parts: 22000 },
  { title: 'CV axle replacement', category: 'mechanical', hours: 1.5, parts: 14000 },
  { title: 'Wheel bearing replacement', category: 'mechanical', hours: 1.5, parts: 9000 },
  { title: 'Exhaust / muffler repair', category: 'mechanical', hours: 1.5, parts: 10000 },
  { title: 'Fuel pump replacement', category: 'mechanical', hours: 3, parts: 20000 },
  { title: 'Spark plug replacement', category: 'mechanical', hours: 1, parts: 6000 },
  { title: 'Air filter + cabin filter replacement', category: 'mechanical', hours: 0.4, parts: 3000 },
  { title: 'Check engine light diagnosis', category: 'mechanical', hours: 1, parts: 0 },
  { title: 'A/C recharge', category: 'mechanical', hours: 1, parts: 6000 },
  { title: 'A/C compressor replacement', category: 'mechanical', hours: 3, parts: 35000 },
  { title: 'Power steering pump replacement', category: 'mechanical', hours: 2, parts: 15000 },

  // Body & Paint
  { title: 'Paint correction (single panel)', category: 'body_paint', hours: 3, parts: 0 },
  { title: 'Paint correction (full vehicle)', category: 'body_paint', hours: 8, parts: 0 },
  { title: 'Bumper repair + repaint', category: 'body_paint', hours: 4, parts: 4000 },
  { title: 'Bumper replacement + paint', category: 'body_paint', hours: 5, parts: 25000 },
  { title: 'Door ding / dent repair (PDR)', category: 'body_paint', hours: 2, parts: 0 },
  { title: 'Panel repaint (single panel)', category: 'body_paint', hours: 5, parts: 8000 },
  { title: 'Scratch / scuff touch-up', category: 'body_paint', hours: 1, parts: 1500 },
  { title: 'Headlight restoration (pair)', category: 'body_paint', hours: 1, parts: 1000 },
  { title: 'Trim / molding replacement', category: 'body_paint', hours: 1, parts: 3500 },
  { title: 'Hail damage repair (minor)', category: 'body_paint', hours: 6, parts: 0 },
  { title: 'Rust spot repair + repaint', category: 'body_paint', hours: 3, parts: 2500 },
  { title: 'Wheel curb rash repair (each)', category: 'body_paint', hours: 1.5, parts: 0 },

  // Detail
  { title: 'Full detail (interior + exterior)', category: 'detail', hours: 3, parts: 0 },
  { title: 'Interior detail', category: 'detail', hours: 2, parts: 0 },
  { title: 'Exterior wash + wax', category: 'detail', hours: 1, parts: 0 },
  { title: 'Carpet / upholstery shampoo', category: 'detail', hours: 1.5, parts: 0 },
  { title: 'Odor removal / ozone treatment', category: 'detail', hours: 1, parts: 0 },
  { title: 'Engine bay detail', category: 'detail', hours: 0.75, parts: 0 },
  { title: 'Ceramic coating application', category: 'detail', hours: 4, parts: 8000 },

  // Glass
  { title: 'Windshield replacement', category: 'glass', hours: 1.5, parts: 22000 },
  { title: 'Windshield chip repair', category: 'glass', hours: 0.5, parts: 1500 },
  { title: 'Side window replacement', category: 'glass', hours: 1, parts: 15000 },
  { title: 'Window regulator replacement', category: 'glass', hours: 2, parts: 9000 },
  { title: 'Side mirror replacement', category: 'glass', hours: 0.75, parts: 8000 },

  // Electrical
  { title: 'Dashboard warning light diagnosis', category: 'electrical', hours: 1, parts: 0 },
  { title: 'Headlight bulb / assembly replacement', category: 'electrical', hours: 0.5, parts: 4000 },
  { title: 'Taillight bulb / assembly replacement', category: 'electrical', hours: 0.5, parts: 3500 },
  { title: 'Power window motor replacement', category: 'electrical', hours: 1.5, parts: 9000 },
  { title: 'Infotainment / backup camera diagnosis', category: 'electrical', hours: 1, parts: 0 },
  { title: 'Wiring harness repair', category: 'electrical', hours: 2, parts: 3000 },
  { title: 'Key fob / remote programming', category: 'electrical', hours: 0.5, parts: 4000 },
];
