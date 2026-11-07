/** Link validation is separate from content review, import status and physical verification. */
export function sourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function sourcesForState(registry, state) {
  return registry.sources.filter(
    (source) => !state || source.states.includes(state),
  );
}

export function locationEvidence(location, registry) {
  const evidence = [];
  const url = sourceUrl(location.sourceUrl);
  if (url)
    evidence.push({
      title: 'Published location evidence',
      url,
      role: 'location-evidence',
    });
  for (const id of location.registrySourceIds || []) {
    const source = registry.sources.find((entry) => entry.id === id);
    const sourceLink = sourceUrl(source?.url);
    if (sourceLink && !evidence.some((entry) => entry.url === sourceLink))
      evidence.push({
        title: source.name,
        url: sourceLink,
        role: 'source-catalog',
      });
  }
  return evidence;
}

export function filterSources(
  registry,
  { state = '', category = '', status = '', query = '' } = {},
) {
  const term = query.trim().toLowerCase();
  return sourcesForState(registry, state).filter(
    (source) =>
      (!category || source.category === category) &&
      (!status || source.status === status) &&
      (!term ||
        [source.id, source.name, source.url, source.notes, ...source.states]
          .join(' ')
          .toLowerCase()
          .includes(term)),
  );
}

export function filterLocations(
  registry,
  { state = '', query = '', includeReview = false } = {},
) {
  const term = query.trim().toLowerCase();
  return registry.locationIndex.filter(
    (location) =>
      (!state || location.state === state) &&
      (includeReview || location.inventoryStatus === 'published-inventory') &&
      (!term ||
        [
          location.id,
          location.state,
          location.route,
          location.title,
          location.sourceId,
          location.sourceSiteId,
        ]
          .join(' ')
          .toLowerCase()
          .includes(term)),
  );
}

export function accessLabel(source) {
  if (!source.lastCheckedAt) return 'Not checked';
  return source.observedHttpStatus
    ? `HTTP ${source.observedHttpStatus} · ${source.lastCheckMethod || 'request'}`
    : source.accessObservation || 'Access not confirmed';
}
