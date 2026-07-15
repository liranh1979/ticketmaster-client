export type AiPillState = 'pending' | 'fresh' | 'stale';

/**
 * Derives a 3-state pill from cached/stale/generatedAt instead of the old binary "Cached"/"Freshly
 * generated" — the "freshly generated this request" case can no longer happen client-side now that
 * AI generation only ever runs in a background job, never on the request path.
 */
export function getAiPillState(cached: boolean, stale: boolean, generatedAt: string | null): AiPillState {
  if (!cached && !generatedAt) return 'pending';
  return stale ? 'stale' : 'fresh';
}

export function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
