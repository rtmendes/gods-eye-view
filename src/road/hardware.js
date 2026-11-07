/** Supported adapters must use documented interfaces; no vendor protocols are assumed. */
export const HARDWARE = [
  {
    id: 'uniden-r8w',
    name: 'Uniden R8w',
    url: 'https://uniden.com/products/r8w',
    capabilities: ['radar', 'laser', 'vendor GPS camera database'],
    integration:
      'Not connected · documented interface or manufacturer agreement required',
  },
  {
    id: 'escort-redline-360c',
    name: 'Escort Redline 360c',
    url: 'https://www.escortradar.com/products/escort_redline_360c',
    capabilities: ['radar', 'laser', 'vendor GPS camera database'],
    integration:
      'Not connected · documented interface or manufacturer agreement required',
  },
];

export function normalizeHardwareEvent(event, now = Date.now()) {
  if (
    !event ||
    !['radar-signal', 'laser-signal', 'speed-sign-observation'].includes(
      event.kind,
    )
  )
    throw new Error('Unsupported hardware observation');
  if (
    typeof event.adapterId !== 'string' ||
    !/^[a-z0-9-]{1,80}$/.test(event.adapterId)
  )
    throw new Error('Invalid adapter identity');
  const observed = Date.parse(event.observedAt),
    expires = Date.parse(event.expiresAt);
  if (
    !Number.isFinite(observed) ||
    !Number.isFinite(expires) ||
    observed > now + 5000 ||
    observed < now - 60000 ||
    expires <= now ||
    expires <= observed ||
    expires - observed > 60000
  )
    throw new Error(
      'Hardware event is expired or outside its allowed lifetime',
    );
  if (
    event.kind === 'speed-sign-observation' &&
    (!Number.isInteger(event.speedLimitMph) ||
      event.speedLimitMph < 5 ||
      event.speedLimitMph > 85)
  )
    throw new Error('Invalid observed speed sign');
  return Object.freeze({
    adapterId: event.adapterId,
    kind: event.kind,
    observedAt: new Date(observed).toISOString(),
    expiresAt: new Date(expires).toISOString(),
    speedLimitMph:
      event.kind === 'speed-sign-observation' ? event.speedLimitMph : null,
    simulation: event.simulation === true,
    equipmentLocationVerified: false,
    publishable: false,
  });
}

export function hardwareMessage(event) {
  const prefix = event.simulation ? 'SIMULATION · ' : '';
  return (
    prefix +
    (event.kind === 'speed-sign-observation'
      ? `${event.speedLimitMph} mph sign observation; road association and temporary conditions unverified.`
      : `${event.kind === 'radar-signal' ? 'Radar' : 'Laser'} signal observation; device type, location and enforcement status unknown.`)
  );
}

export function approvedOffer(offer) {
  if (
    !offer ||
    offer.enabled !== true ||
    offer.relationship !== 'affiliate' ||
    !offer.disclosure?.trim()
  )
    return null;
  try {
    const url = new URL(offer.url);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return { ...offer, url: url.href };
  } catch {
    return null;
  }
}

export function commercialVisible({ driving, speedMph }) {
  return driving === false && Number.isFinite(speedMph) && speedMph === 0;
}
