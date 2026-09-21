/**
 * Fills a copy-catalogue template's `{token}` placeholders with DATA values — a patient's first
 * name, a relationship word — never with another catalogue string (that would be two lookups
 * pretending to be one). Used by RoleSwitch (the caregiver-option label) and the More menu's
 * quiet pending-invitation notice.
 */
export function interpolate(template: string, vars: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}
