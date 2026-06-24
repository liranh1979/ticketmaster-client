export interface DateTimeFormatOptions {
  timezone?: string;
  hour12?: boolean;
}

function toDate(value: Date | string | number): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(value: Date | string | number, opts: DateTimeFormatOptions = {}): string {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(undefined, {
    timeZone: opts.timezone,
    hour12: opts.hour12,
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export function formatDate(value: Date | string | number, opts: DateTimeFormatOptions = {}): string {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(undefined, {
    timeZone: opts.timezone,
    year: 'numeric', month: 'short', day: '2-digit',
  }).format(d);
}

export function formatTime(value: Date | string | number, opts: DateTimeFormatOptions = {}): string {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(undefined, {
    timeZone: opts.timezone,
    hour12: opts.hour12,
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}
