export const PIPELINE_STAGES = [
  'inspection',
  'estimate',
  'approval',
  'parts',
  'mechanical',
  'body_paint',
  'detail',
  'qc',
  'ready',
];

export const STAGE_LABELS = {
  inspection: 'Inspection',
  estimate: 'Estimate',
  approval: 'Approval',
  parts: 'Parts',
  mechanical: 'Mechanical',
  body_paint: 'Body & Paint',
  detail: 'Detail',
  qc: 'QC',
  ready: 'Ready',
};

export const BLOCKED_REASON_LABELS = {
  parts: 'Parts',
  approval: 'Approval',
  sublet: 'Sublet',
  payment: 'Payment',
};

// Threshold (hours) at which a card's time-in-stage badge turns red.
const STAGE_THRESHOLD_HOURS = {
  approval: 24,
  parts: 48,
};
const DEFAULT_THRESHOLD_HOURS = 24;

export function isStale(stage, hoursInStage) {
  const threshold = STAGE_THRESHOLD_HOURS[stage] ?? DEFAULT_THRESHOLD_HOURS;
  return hoursInStage >= threshold;
}

export function blockedOwner(blockedReason) {
  if (blockedReason === 'parts' || blockedReason === 'sublet') return 'vendor';
  if (blockedReason === 'approval' || blockedReason === 'payment') return 'dealer';
  return 'shop';
}
