import api from '../api';

const BATCH_SIZE = 20;

export interface BulkTranslateProgress {
  done: number;
  total: number;
  currentBatch: number;
  totalBatches: number;
}

export interface BulkTranslateRunResult {
  translations: Record<string, string>;
  /** true if a batch failed and we stopped early — caller should save what's in `translations` immediately. */
  partial: boolean;
  error?: string;
}

/**
 * Translates `englishSource` in batches of BATCH_SIZE keys per call to /ai/translate-bulk,
 * reporting progress after each batch. If a batch fails (rate limit, quota, network, etc.),
 * stops immediately and returns whatever batches already succeeded so the caller can save
 * that partial progress instead of losing it.
 */
export async function runBulkTranslate(
  englishSource: Record<string, string>,
  targetLang: string,
  onProgress?: (p: BulkTranslateProgress) => void,
): Promise<BulkTranslateRunResult> {
  const keys = Object.keys(englishSource);
  const batches: string[][] = [];
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    batches.push(keys.slice(i, i + BATCH_SIZE));
  }

  const accumulated: Record<string, string> = {};
  const totalBatches = batches.length;

  for (let i = 0; i < batches.length; i++) {
    onProgress?.({ done: i * BATCH_SIZE, total: keys.length, currentBatch: i + 1, totalBatches });

    const batchSource: Record<string, string> = {};
    batches[i].forEach(k => { batchSource[k] = englishSource[k]; });

    try {
      const res = await api.post('/ai/translate-bulk', { translations: batchSource, targetLanguage: targetLang });
      if (!res.data?.success) {
        // No active AI provider, or the provider call failed without throwing (e.g. bad
        // response shape) — bail out now rather than silently looping through every
        // remaining batch with nothing to show for it.
        return { translations: accumulated, partial: true, error: 'AI translation failed — check your AI provider settings.' };
      }
      if (res.data.translations) {
        Object.assign(accumulated, res.data.translations);
      }
    } catch (err: any) {
      return {
        translations: accumulated,
        partial: true,
        error: err.response?.data?.message || err.message || 'Translation request failed',
      };
    }
  }

  onProgress?.({ done: keys.length, total: keys.length, currentBatch: totalBatches, totalBatches });
  return { translations: accumulated, partial: false };
}
