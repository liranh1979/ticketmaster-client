import type { FieldMappingRequest } from './ExternalApiCallsEditor';

// Client-side, preview-only mirror of ExternalApiActionExecutor.substitute/substituteForUrl — the
// backend is always the one that actually runs a call; this only gives the admin a live look at
// what Step 3's mapping will produce. Same {{[a-zA-Z0-9_]+}} placeholder convention. Note: uses
// encodeURIComponent (RFC 3986, space -> %20) rather than the backend's Java URLEncoder
// (application/x-www-form-urlencoded, space -> +) — a harmless cosmetic difference for a preview
// that's never sent anywhere.
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const bareFieldKey = (ticketField: string): string =>
  ticketField.startsWith('ticket.') ? ticketField.slice('ticket.'.length)
    : ticketField.startsWith('this.') ? ticketField.slice('this.'.length)
    : ticketField;

/** Builds the {placeholder: value} map Step 3's preview substitutes with, falling back to a visually distinct "unmapped" marker (never a silent blank) when a mapped field has no sample value yet. */
export function buildPreviewVars(
  requestMappings: FieldMappingRequest[],
  sampleValues: Record<string, string>,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const m of requestMappings) {
    const key = bareFieldKey(m.ticketField);
    vars[m.placeholder] = sampleValues[key] ?? `‹${m.ticketField}›`;
  }
  return vars;
}

/** Substitutes {{placeholder}} occurrences in `template` from `vars`; a placeholder with no entry at all (not even the "unmapped" marker from buildPreviewVars) renders as ‹placeholder› rather than silently blank, so a still-unmapped input is always visible in the preview. */
export function substituteForPreview(template: string, vars: Record<string, string>, urlEncode: boolean): string {
  return template.replace(PLACEHOLDER_RE, (_match, name: string) => {
    const value = vars[name];
    if (value === undefined) return `‹${name}›`;
    return urlEncode ? encodeURIComponent(value) : value;
  });
}
