/**
 * Guard P — the three values the owner still owes (real sourceCitation, copy deck, real bot handle;
 * the demo script is the owner's own deliverable, not a code artifact, and is never counted). Counts
 * and lists, never fails on the count itself; reported at every gate.
 *  (a) every literal `[TO BE SUPPLIED]` / `= TO_BE_SUPPLIED` marker in code — a value that is missing;
 *  (b) every `placeholder: true` copy entry under i18n/copy — wording the bilingual deck has not
 *      replaced yet. Copy is marked with a flag rather than with the literal marker because a screen
 *      full of "[TO BE SUPPLIED]" cannot be reviewed for layout, direction or state; the flag keeps the
 *      count honest while the draft wording keeps the screen reviewable.
 * A value is never invented and never plausible-looking.
 *
 * AP-16: agents/ added as its own scanned scope, tallied separately from the app's — a guard that
 * only ever looked at the app would say nothing about the markers the agents side ships on purpose.
 * It fails loudly (rule "guard input missing") the moment either scope has no file scanned at all;
 * a count of zero markers within a scope that WAS scanned is never a failure. Runtime proof: none by
 * design, it counts and lists; printed at every gate (plan 7.3 AP-16).
 */
import { walk, rel, type GuardResult, type Violation } from './_shared';
import { readFileSync } from 'node:fs';

export interface Source { path: string; text: string }

const EXTS = ['.ts', '.tsx', '.js', '.json'];
export const APP_DIRS = ['app', 'components', 'features', 'lib', 'i18n', 'types', 'public', 'design'];
export const AGENT_DIRS = ['agents'];
const MARKER_RE = /\[TO BE SUPPLIED\]|(?<![=!])[=:]\s*TO_BE_SUPPLIED\b/g;

const isAgentPath = (path: string) => path === 'agents' || path.startsWith('agents/');

interface Scope { scanned: number; markerCount: number; markers: string[]; copyCount: number; copyFiles: Record<string, number> }
const emptyScope = (): Scope => ({ scanned: 0, markerCount: 0, markers: [], copyCount: 0, copyFiles: {} });

/** The pure check, over any set of sources (the test feeds it deliberately edited copies). Every
 * `path` is already repo-relative, exactly as `run()` produces with `rel()`. */
export function check(sources: Source[]): GuardResult {
  const app = emptyScope();
  const agents = emptyScope();
  for (const { path, text } of sources) {
    const scope = isAgentPath(path) ? agents : app;
    scope.scanned++;
    text.split('\n').forEach((line, i) => {
      const n = (line.match(MARKER_RE) ?? []).length;
      if (n && !/export const TO_BE_SUPPLIED/.test(line)) {
        scope.markerCount += n;
        scope.markers.push(`${path}:${i + 1}  ${line.trim().slice(0, 120)}`);
      }
      if (path.startsWith('i18n/copy/') && /placeholder:\s*true/.test(line)) {
        scope.copyCount++;
        scope.copyFiles[path] = (scope.copyFiles[path] ?? 0) + 1;
      }
    });
  }

  const violations: Violation[] = [];
  if (app.scanned === 0) violations.push({ file: APP_DIRS.join(', '), line: 0, text: 'no app file was scanned', rule: 'guard input missing' });
  if (agents.scanned === 0) violations.push({ file: AGENT_DIRS.join(', '), line: 0, text: 'no agents/ file was scanned', rule: 'guard input missing' });

  const section = (heading: string, s: Scope) => [
    `${heading}:`,
    `  missing values marked [TO BE SUPPLIED]: ${s.markerCount}`,
    ...(s.markers.length ? s.markers.map((m) => `  ${m}`) : ['  none']),
  ];
  const notes = [
    ...section('app', app),
    ...section('agents/', agents),
    `copy entries awaiting the bilingual deck (placeholder: true): ${app.copyCount + agents.copyCount}`,
    ...Object.entries({ ...app.copyFiles, ...agents.copyFiles }).map(([f, n]) => `  ${f}: ${n}`),
  ];
  return {
    name: `guard P · owed values: app ${app.markerCount} missing, agents ${agents.markerCount} missing, ${app.copyCount + agents.copyCount} placeholder copy entries`,
    violations,
    notes,
  };
}

export function run(): GuardResult {
  const files = [...APP_DIRS.flatMap((d) => walk(d, EXTS)), ...AGENT_DIRS.flatMap((d) => walk(d, EXTS))];
  const sources = files.map((f) => ({ path: rel(f), text: readFileSync(f, 'utf8') }));
  return check(sources);
}
