// @vitest-environment node
/**
 * CR-061 (AP-12; DECISIONS CR-091), the static half. Migration 0014 is applied by the lead after
 * merge, not by the build, and its runtime proof (tests/integration/enforcement/audit.test.ts)
 * needs a database. This file runs in `npm test` and checks two things the database cannot see:
 *
 *  1. The migration is what the notes say: the last file, one restrictive INSERT policy for
 *     jurah_app, idempotent, and nothing that weakens RLS.
 *  2. The seam's writers fit the policy. 0014 refuses, from jurah_app, a row naming the agent
 *     unless it comes from withSystem() as prescription_discontinued (D-025), and any
 *     dose_status_recorded row from a user session. So every append() in product code that names
 *     the agent must run under withAgent(), or be that one D-025 row under withSystem(); and no
 *     append() may write dose_status_recorded (the trigger alone writes it). A new writer that
 *     breaks this would work until 0014 is applied and then fail in production, so it fails here
 *     first.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rel, walk } from '../../../scripts/guards/_shared';

const MIGRATIONS = 'supabase/migrations';
// A plain string: guard 8 reads the word sql followed by a backtick as a tagged SQL template.
const FILE = MIGRATIONS + '/0014_audit_insert_actor.sql';

/** SQL with its `--` comments removed, whitespace collapsed, lower case. */
function sqlBody(src: string): string {
  return src.split(/\r?\n/).map((l) => l.replace(/--.*$/, '')).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** TypeScript with block and line comments removed (naive, enough for the call shapes below). */
function codeBody(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');
}

describe('CR-061 · migration 0014, as written', () => {
  it('is the newest migration and the only 0014', () => {
    const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
    expect(files.filter((f) => f.startsWith('0014_'))).toEqual(['0014_audit_insert_actor.sql']);
    expect(files.at(-1)).toBe('0014_audit_insert_actor.sql');
  });

  it('holds exactly one drop-if-exists and one restrictive INSERT policy for jurah_app on audit_events', () => {
    const body = sqlBody(readFileSync(FILE, 'utf8'));
    const statements = body.split(';').map((s) => s.trim()).filter(Boolean);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toBe('drop policy if exists audit_insert_actor on audit_events');
    expect(statements[1]).toMatch(/^create policy audit_insert_actor on audit_events as restrictive for insert to jurah_app with check \(/);
    // the rule itself, clause by clause
    expect(statements[1]).toContain('jurah_session() is not null');
    expect(statements[1]).toContain("when jurah_session_is('system') then actor_role <> 'agent' or type = 'prescription_discontinued'");
    expect(statements[1]).toContain("else actor_role <> 'agent' and type <> 'dose_status_recorded'");
  });

  it('weakens nothing: no disabled or forced-off RLS, no always-true check, no grant, no row written', () => {
    const body = sqlBody(readFileSync(FILE, 'utf8'));
    expect(body).not.toMatch(/disable row level security|no force row level security/);
    expect(body).not.toMatch(/using \(\s*true\s*\)|with check \(\s*true\s*\)/);
    expect(body).not.toMatch(/\bgrant\b|\brevoke\b|\balter table\b/);
    expect(body).not.toMatch(/\binsert into\b|\bupdate\b|\bdelete from\b|\btruncate\b/);
  });
});

/** `type` is the event type literal; a conditional (`now ? 'a' : 'b'`) lists both, joined by `|`. */
interface AppendSite { file: string; wrapper: string; namesAgent: boolean; type: string }

/** Every append(sql, {...}) call in product code, with the nearest enclosing with*() before it. */
function appendSites(): AppendSite[] {
  const files = walk('lib', ['.ts']).map(rel).filter((f) => !f.includes('/mock') && !f.endsWith('.test.ts'));
  const sites: AppendSite[] = [];
  for (const file of files) {
    const src = codeBody(readFileSync(file, 'utf8'));
    if (!/from ['"]@\/lib\/db\/audit['"]/.test(src)) continue;
    for (const m of src.matchAll(/\bappend\(\s*(sql|tx)\s*,\s*\{/g)) {
      const at = m.index ?? 0;
      const before = src.slice(0, at);
      const wrappers = [...before.matchAll(/\b(withAgent|withSystem|withSession)\(/g)];
      const wrapper = wrappers.at(-1)?.[1] ?? '(none)';
      // the object literal of this call: up to the first `})` after it
      const end = src.indexOf('})', at);
      const obj = src.slice(at, end === -1 ? undefined : end);
      const actor = /actor:\s*\{([^}]*)\}/.exec(obj)?.[1] ?? '';
      const typeExpr = /(?<![\w.])type:\s*([^,\n]+)/.exec(obj)?.[1] ?? '';
      const literals = [...typeExpr.matchAll(/'([a-z_]+)'/g)].map((t) => t[1]);
      const type = literals.length > 0 ? literals.join('|') : '(not a literal)';
      sites.push({ file, wrapper, namesAgent: /'agent'/.test(actor), type });
    }
  }
  return sites;
}

describe('CR-061 · the seam writes only rows 0014 admits', () => {
  it('finds the append() call sites (the scan sees its input)', () => {
    const sites = appendSites();
    // lib/db/audit.ts is the one insert; its callers are the pg seam, the session pg and the engine.
    expect(sites.length).toBeGreaterThanOrEqual(20);
    expect(new Set(sites.map((s) => s.file))).toEqual(new Set([
      'lib/data/pg/agent.ts', 'lib/data/pg/channels.ts', 'lib/data/pg/reads-rx.ts', 'lib/data/pg/writes.ts',
      'lib/engine/expiry.ts', 'lib/session/pg/index.ts',
    ]));
    expect(sites.filter((s) => s.wrapper === '(none)' && s.file !== 'lib/engine/expiry.ts')).toEqual([]);
  });

  it('a row naming the agent comes from withAgent(), or is D-025\'s prescription_discontinued under withSystem()', () => {
    const agentRows = appendSites().filter((s) => s.namesAgent);
    expect(agentRows).toEqual([
      { file: 'lib/data/pg/agent.ts', wrapper: 'withSystem', namesAgent: true, type: 'prescription_discontinued' },
      { file: 'lib/data/pg/agent.ts', wrapper: 'withAgent', namesAgent: true, type: 'alert_raised' },
      { file: 'lib/data/pg/agent.ts', wrapper: 'withAgent', namesAgent: true, type: 'prescription_added' },
    ]);
    for (const s of agentRows) {
      expect(s.wrapper === 'withAgent' || (s.wrapper === 'withSystem' && s.type === 'prescription_discontinued'), JSON.stringify(s)).toBe(true);
    }
  });

  it('no append() writes dose_status_recorded: the trigger doses_status_recorded_audit is its one writer', () => {
    expect(appendSites().filter((s) => s.type.split('|').includes('dose_status_recorded'))).toEqual([]);
    expect(appendSites().filter((s) => s.type === '(not a literal)')).toEqual([]);
  });

  it('the premise: withAgent() runs as jurah_agent with session role agent, withSystem() as jurah_app with role system', () => {
    const src = readFileSync('lib/db/withSession.ts', 'utf8');
    expect(src).toMatch(/export function withAgent<T>\(fn: \(sql: Tx\) => Promise<T>\): Promise<T> \{\s*return run\('jurah_agent', async \(\) => \(\{ role: 'agent' \}\), fn\);/);
    expect(src).toMatch(/export function withSystem<T>\(fn: \(sql: Tx\) => Promise<T>\): Promise<T> \{\s*return run\('jurah_app', async \(\) => \(\{ role: 'system' \}\), fn\);/);
    // and no cookie can carry role 'system' into withSession(): verify.ts admits the four user roles only
    expect(readFileSync('lib/session/verify.ts', 'utf8')).toContain("const ROLES: readonly Role[] = ['patient', 'caregiver', 'reviewer', 'admin'];");
  });
});
