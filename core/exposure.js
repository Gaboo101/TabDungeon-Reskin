export function createTrackingState({
  tabId,
  windowId,
  urlKey,
  metadata = {},
  now
}) {
  const timestamp = Number.isFinite(now) ? now : 0;
  return {
    tabId,
    windowId,
    urlKey,
    metadata,
    startedAt: timestamp,
    lastFlushedAt: timestamp
  };
}

export function advanceTrackingState(state, now, maxElapsedMs = 5 * 60 * 1000) {
  const timestamp = Number.isFinite(now) ? now : 0;
  const previous = Number.isFinite(state?.lastFlushedAt)
    ? state.lastFlushedAt
    : Number.isFinite(state?.startedAt)
      ? state.startedAt
      : timestamp;
  const elapsedMs = Math.max(0, Math.min(maxElapsedMs, timestamp - previous));
  return {
    state: {
      ...(state || {}),
      lastFlushedAt: timestamp
    },
    elapsedMs
  };
}
