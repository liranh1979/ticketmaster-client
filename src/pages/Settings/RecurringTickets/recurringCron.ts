export type FrequencyType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'CUSTOM';

export interface FrequencyInput {
  frequency: FrequencyType;
  dayOfWeek?: number;   // 1(Mon)..7(Sun) — WEEKLY
  dayOfMonth?: number;  // 1..28 — MONTHLY/QUARTERLY
  hour: number;
  minute: number;
  customCron?: string;  // CUSTOM
}

/**
 * Maps the 5-way frequency-pill selection down to a single 6-field cron string
 * (sec min hour dom month dow) — the sole value persisted/sent to the backend.
 * QUARTERLY fires on dayOfMonth every 3rd month (Jan/Apr/Jul/Oct).
 */
export function buildCronExpression(input: FrequencyInput): string {
  const { frequency, dayOfWeek = 1, dayOfMonth = 1, hour, minute, customCron } = input;
  switch (frequency) {
    case 'DAILY':
      return `0 ${minute} ${hour} * * ?`;
    case 'WEEKLY':
      return `0 ${minute} ${hour} ? * ${dayOfWeek}`;
    case 'MONTHLY':
      return `0 ${minute} ${hour} ${dayOfMonth} * ?`;
    case 'QUARTERLY':
      return `0 ${minute} ${hour} ${dayOfMonth} 1,4,7,10 ?`;
    case 'CUSTOM':
      return customCron ?? '';
    default:
      return '';
  }
}

function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Plain-JS regex substitution for {{month}}/{{year}}/{{week}}/{{quarter}} — deliberately NOT routed
 * through react-i18next's t(), which shares this app's {{ }} delimiter syntax and would otherwise
 * try to interpolate these as i18next options. Mirrors the backend's
 * RecurringTicketSchedulerService.substituteTitlePlaceholders() 1:1 for an accurate preview.
 */
export function previewTitle(template: string, at: Date): string {
  const month = at.toLocaleString('en-US', { month: 'long' });
  const year = String(at.getFullYear());
  const quarter = String(Math.floor(at.getMonth() / 3) + 1);
  const week = String(getIsoWeek(at));
  return template
    .replace(/\{\{\s*month\s*\}\}/gi, month)
    .replace(/\{\{\s*year\s*\}\}/gi, year)
    .replace(/\{\{\s*week\s*\}\}/gi, week)
    .replace(/\{\{\s*quarter\s*\}\}/gi, quarter);
}
