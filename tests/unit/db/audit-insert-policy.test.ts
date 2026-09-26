// @vitest-environment node
/**
 * CR-061 (AP-12; DECISIONS CR-091), the static half. Migration 0014 is applied by the lead after
 * merge, not by the build, and its runtime proof (tests/integration/enforcement/audit.test.ts)
 * needs a database. This file runs in `npm test` and checks two things the database cannot see:
 *
 *  1. The migration is what the notes say: no later file touches a policy, one restrictive INSERT policy for
 *     jurah_app, idempotent, and nothing that weakens RLS.
 *  2. The seam's writers fit the policy. 0014 refuses, from jurah_app, a row naming the agent
 *     unless it comes from withSystem() as prescription_discontinued (D-025), and every
 *     dose_status_recorded row, the system session's included. So every append() in product code
 *     that names the agent must run under withAgent(), or be that one D-025 row under
 *     withSystem(); and no append() may write dose_status_recorded (the trigger alone writes it,
 *     and under jurah_app it never fires, because jurah_app holds no UPDATE on doses.status). A
 *     new writer that breaks this would work until 0014 is applied and then fail in production,
 *     so it fails here first. The scan fails loudly on an actor or a type it cannot read: an input
 *     it cannot see is never counted as "does not name the agent".
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
  it('is the only 0014, and no later migration touches an audit policy or RLS', () => {
    const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
    expect(files.filter((f) => f.startsWith('0014_'))).toEqual(['0014_audit_insert_actor.sql']);
    // "The last file" was the rule while 0014 was newest; CR-115's 0015 followed. What it protected
    // still holds: nothing after 0014 may drop or recreate a policy, touch audit_events' policies, or
    // weaken row-level security.
    const later = files.slice(files.indexOf('0014_audit_insert_actor.sql') + 1);
    for (const f of later) {
      const body = sqlBody(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
      expect(body, f).not.toMatch(/\b(drop|create|alter) policy\b/);
      expect(body, f).not.toMatch(/\bon audit_events\b/);
      expect(body, f).not.toMatch(/(disable|no force) row level security/);
    }
  });

  it('holds exactly one drop-if-exists and one restrictive INSERT policy for jurah_app on audit_events', () => {
    const body = sqlBody(readFileSync(FILE, 'utf8'));
    const statements = body.split(';').map((s) => s.trim()).filter(Boolean);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toBe('drop policy if exists audit_insert_actor on audit_events');
    expect(statements[1]).toMatch(/^create policy audit_insert_actor on audit_events as restrictive for insert to jurah_app with check \(/);
    // the rule itself, clause by clause
    // the rule itself, whole: no other clause may sit beside these three
    expect(statements[1]).toBe(
      'create policy audit_insert_actor on audit_events as restrictive for insert to jurah_app with check ( '
      + 'jurah_session() is not null '
      + "and type <> 'dose_status_recorded' "
      + "and (actor_role <> 'agent' or (jurah_session_is('system') and type = 'prescription_discontinued')) )",
    );
  });

  it('the premise of refusing dose_status_recorded from every jurah_app session: jurah_app cannot update doses.status', () => {
    // The row's one writer is the trigger `after update of status on doses`. If jurah_app ever gains
    // the status column, the trigger would fire under jurah_app and 0014 would refuse its row; this
    // fails first, so the grant and the policy are revisited together.
    const grants = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort().flatMap((f) =>
      sqlBody(readFileSync(`${MIGRATIONS}/${f}`, 'utf8')).split(';').map((s) => s.trim())
        // any privilege grant that names doses, or every table at once, in any form
        .filter((s) => /^grant\b(?!\s+execute\b)/.test(s) && /\bdoses\b|\ball tables\b/.test(s)).map((s) => `${f}: ${s}`));
    expect(grants).toEqual([
      '0005_rls.sql: grant select, insert, delete on doses to jurah_app',
      '0005_rls.sql: grant update (scheduled_at, tracked) on doses to jurah_app',
      '0005_rls.sql: grant select, insert on doses to jurah_agent',
      '0005_rls.sql: grant update (status, recorded_at, source) on doses to jurah_agent',
    ]);
    expect(sqlBody(readFileSync(MIGRATIONS + '/0004_constraints_and_triggers.sql', 'utf8'))).toContain(
      'create or replace trigger doses_status_recorded_audit after update of status on doses for each row execute function doses_status_recorded_audit()',
    );
  });

  it('weakens nothing: no disabled or forced-off RLS, no always-true check, no grant, no row written', () => {
    const body = sqlBody(readFileSync(FILE, 'utf8'));
    expect(body).not.toMatch(/disable row level security|no force row level security/);
    expect(body).not.toMatch(/using \(\s*true\s*\)|with check \(\s*true\s*\)/);
    expect(body).not.toMatch(/\bgrant\b|\brevoke\b|\balter table\b/);
    expect(body).not.toMatch(/\binsert into\b|\bupdate\b|\bdelete from\b|\btruncate\b/);
  });
});

/**
 * `type` is the event type literal; a conditional (`now ? 'a' : 'b'`) lists both, joined by `|`.
 * `actorRole` is the actor's role literal, or the roles an allow-listed typed expression can take,
 * joined by `|`. Anything else, a missing `actor: {` object included, is '(not a literal)'.
 */
interface AppendSite { file: string; wrapper: string; actorRole: string; type: string }

/**
 * The typed, non-literal actor roles the seam writes today, and the roles each one can take. A form
 * not listed here is '(not a literal)', which fails the scan: a new form is read, then added here.
 */
const DYNAMIC_ACTOR_ROLES: Record<string, string> = {
  // lib/session/pg/index.ts (sign-in, sign-out): s is a Session and s.role a Role (types/views.ts),
  // the four user roles only; the last test asserts that declaration.
  "s.role ?? 'system'": 'patient|caregiver|reviewer|admin|system',
  // lib/data/pg/channels.ts (messaging_connected)
  "patient ? 'patient' : 'caregiver'": 'patient|caregiver',
};

function actorRoleOf(obj: string): string {
  const expr = /actor:\s*\{\s*role:\s*([^,}]+?)\s*[,}]/.exec(obj)?.[1];
  if (expr === undefined) return '(not a literal)';
  const literal = /^'([a-z_]+)'$/.exec(expr)?.[1];
  if (literal !== undefined) return literal;
  return Object.hasOwn(DYNAMIC_ACTOR_ROLES, expr) ? DYNAMIC_ACTOR_ROLES[expr]! : '(not a literal)';
}

function namesAgent(s: AppendSite): boolean {
  return s.actorRole.split('|').includes('agent');
}

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
      const typeExpr = /(?<![\w.])type:\s*([^,\n]+)/.exec(obj)?.[1] ?? '';
      const literals = [...typeExpr.matchAll(/'([a-z_]+)'/g)].map((t) => t[1]);
      const type = literals.length > 0 ? literals.join('|') : '(not a literal)';
      sites.push({ file, wrapper, actorRole: actorRoleOf(obj), type });
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
    const sites = appendSites();
    // an actor the scan cannot read fails here; it never counts as "does not name the agent"
    expect(sites.filter((s) => s.actorRole === '(not a literal)')).toEqual([]);
    const agentRows = sites.filter(namesAgent);
    expect(agentRows).toEqual([
      { file: 'lib/data/pg/agent.ts', wrapper: 'withSystem', actorRole: 'agent', type: 'prescription_discontinued' },
      { file: 'lib/data/pg/agent.ts', wrapper: 'withAgent', actorRole: 'agent', type: 'alert_raised' },
      { file: 'lib/data/pg/agent.ts', wrapper: 'withAgent', actorRole: 'agent', type: 'prescription_added' },
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
    // and the allow-listed `s.role ?? 'system'` can never be 'agent': Role is the four user roles
    expect(readFileSync('types/views.ts', 'utf8')).toContain("export type Role = 'patient' | 'caregiver' | 'reviewer' | 'admin';");
  });
});
