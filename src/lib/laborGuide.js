export const CATEGORY_LABELS = {
  mechanical: 'Mechanical',
  body_paint: 'Body & Paint',
  detail: 'Detail',
  glass: 'Glass',
  electrical: 'Electrical',
  custom: 'Custom',
};

export function partsPriceFromCost(costCents, markupPct) {
  return Math.round((costCents || 0) * (1 + (markupPct || 0) / 100));
}
