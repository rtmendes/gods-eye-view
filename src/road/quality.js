import { safeUrl, temporalStatus } from '../driving/model.js';

/** Explicit rights evidence is required before a source is cleared for commercial reuse. */
export function commercialUseAllowed(source) {
  return (
    source?.reuse?.status === 'cleared' &&
    ['display', 'commercial'].every((right) =>
      source.reuse.rights?.includes(right),
    ) &&
    !!safeUrl(source.reuse.evidenceUrl)
  );
}

export function assessPublication(record, source, now = Date.now()) {
  const reasons = [];
  if (!record.geometry) reasons.push('No mapped position');
  if (record.type === 'monitoring')
    reasons.push('Monitoring only; never a citation-camera alert');
  const status = temporalStatus(record, now);
  if (['stale', 'completed', 'paused', 'expired'].includes(status))
    reasons.push(`Record is ${status}`);
  if (
    record.coordinateMeaning !== 'physical-device' ||
    !record.equipmentPositionVerified
  )
    reasons.push('Physical equipment position unverified');
  const hasDirection = record.travelBearings?.length > 0;
  if (!hasDirection) reasons.push('Travel direction unverified');
  return {
    commercialCleared: commercialUseAllowed(source),
    exactEquipmentPosition:
      record.coordinateMeaning === 'physical-device' &&
      record.equipmentPositionVerified === true,
    reasons,
  };
}
