/**
 * What the Deck reports about this server's configuration: which provider
 * keys are set (names only, never values) and what the chat and hand-off are
 * configured to do. Reads an env object it is given, never process.env, so it
 * is portable and testable.
 */

/** Models the chat may be configured with; the first is the default. */
export const DECK_MODEL_DEFAULT = 'claude-opus-5-5';
export const DECK_EFFORT_DEFAULT = 'medium';
export const DECK_EFFORTS = Object.freeze([
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
]);
export const DECK_HANDOFF_LABEL_DEFAULT = 'Elite Writer';

/**
 * Provider credentials the globe can use, with what each one switches on.
 * The dashboard shows these as capability chips; a missing key is a known
 * gap, not an error.
 */
export const PROVIDERS = Object.freeze([
  {
    name: 'ANTHROPIC_API_KEY',
    label: 'Claude',
    enables: 'The Deck chat and publishing packs',
  },
  {
    name: 'OPENAI_API_KEY',
    label: 'OpenAI Realtime',
    enables: 'Voice control inside the globe',
  },
  {
    name: 'CESIUM_ION_TOKEN',
    label: 'Cesium ion',
    enables: 'Photorealistic 3D cities and world terrain',
  },
  {
    name: 'GOOGLE_MAPS_API_KEY',
    label: 'Google Maps',
    enables: 'Direct Google 3D tiles and place search',
  },
  {
    name: 'AISSTREAM_API_KEY',
    label: 'AISStream',
    enables: 'Live vessels',
  },
  {
    name: 'FIRMS_MAP_KEY',
    label: 'NASA FIRMS',
    enables: 'Live active fires',
  },
  {
    name: 'TOMTOM_API_KEY',
    label: 'TomTom',
    enables: 'Live traffic flow speeds',
  },
  {
    name: 'MAPILLARY_CLIENT_TOKEN',
    label: 'Mapillary',
    enables: 'Street-level imagery',
  },
  {
    name: 'OPENSKY_CLIENT_ID',
    label: 'OpenSky',
    enables: 'More flight polling credits',
  },
  {
    name: 'LL2_API_TOKEN',
    label: 'Launch Library 2',
    enables: 'Higher space-missions allowance',
  },
]);

/** A value counts as configured when it is set and not a placeholder. */
export function isConfiguredValue(value) {
  const normalized = String(value ?? '').trim();
  return (
    normalized.length > 0 &&
    !/^(your_|replace_|example|changeme)/i.test(normalized)
  );
}

/** Each provider with whether its key is configured. Values never leave. */
export function providerStatus(env = {}) {
  return PROVIDERS.map((provider) => ({
    ...provider,
    configured: isConfiguredValue(env[provider.name]),
  }));
}

/** The chat model from the environment, or the default. */
export function resolveModel(env = {}) {
  const value = String(env.GEV_DECK_MODEL ?? '').trim();
  return /^[a-z0-9-]{3,64}$/.test(value) ? value : DECK_MODEL_DEFAULT;
}

/** The chat effort from the environment, or the default. */
export function resolveEffort(env = {}) {
  const value = String(env.GEV_DECK_EFFORT ?? '')
    .trim()
    .toLowerCase();
  return DECK_EFFORTS.includes(value) ? value : DECK_EFFORT_DEFAULT;
}

/** Whether server-side refusal fallbacks are requested (on unless `0`). */
export function fallbacksEnabled(env = {}) {
  return !/^(0|false|off)$/i.test(String(env.GEV_DECK_FALLBACKS ?? '').trim());
}

/** The hand-off target, when one is configured. Only its presence and label are reported. */
export function handoffConfig(env = {}) {
  const url = String(env.GEV_DECK_HANDOFF_WEBHOOK_URL ?? '').trim();
  let configured = false;
  try {
    configured = ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    configured = false;
  }
  return {
    configured,
    label:
      String(env.GEV_DECK_HANDOFF_LABEL ?? '').trim() ||
      DECK_HANDOFF_LABEL_DEFAULT,
  };
}

/** Everything the dashboard asks about the server, with no secret values. */
export function deckStatus(env = {}, { version = null, appUrl = null } = {}) {
  return {
    version,
    appUrl,
    chat: {
      configured: isConfiguredValue(env.ANTHROPIC_API_KEY),
      model: resolveModel(env),
      effort: resolveEffort(env),
    },
    handoff: handoffConfig(env),
    embed: {
      frameAncestors: String(env.GEV_EMBED_FRAME_ANCESTORS ?? '').trim(),
    },
    providers: providerStatus(env),
  };
}
