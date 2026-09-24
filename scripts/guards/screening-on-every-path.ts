/**
 * Guard R — screening on every path (AP-10; the static half of plan AP-16 row 2). Runtime proofs
 * beside it: tests/unit/agent-webhooks/triggers.test.ts (each trigger calls screening after its
 * commit, awaited) and, live, journeys J8 and J13.
 *
 * Every top-level function in the code allowed to hold SQL (lib/data/**, lib/engine/**,
 * lib/session/**; guard 8) that
 *   - creates a prescription                 (`insert into prescriptions`),
 *   - confirms a flagged prescription        (`update prescriptions … needs_review = false` or
 *                                             `field_review_status = 'confirmed'`), or
 *   - requests a refill, D10 / CR-082        (`insert into refill_requests`)
 * must call screenOrHold( (lib/data/pg/screening.ts) or requestScreening( in its own body, and never
 * from inside its transaction callback (withSession / withAgent / withSystem): the agent reads the
 * prescription back, so screening must come after the commit.
 *
 * A statement counts when the function holds it inline (a string or template literal) or names a
 * query constant whose text holds it (`PG_QUERIES_RX.insertPrescription`, a top-level const).
 *
 * The guard fails loudly when its input is missing: no statement of a kind found anywhere, or one of
 * the four paths known today (savePrescriptionDraft, insertExtractedPrescription,
 * confirmPrescriptionFields, requestRefill) no longer recognised as a trigger. A refactor that moves a
 * write where this detector cannot see it therefore turns the guard red instead of silently green.
 *
 * Not scanned: lib/data/mock-impl.ts and lib/data/mock/** hold no SQL. They are the Phase 1 mock
 * backend (an in-memory store with no screening agent behind it, CR-049) and never serve production
 * (lib/db/client selectedBackend); the notes line says so on every run.
 */
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { walk, rel, type GuardResult, type Violation } from './_shared';

const SCOPE = ['lib/data', 'lib/engine', 'lib/session'];

export const TRIGGER_KINDS = [
  { kind: 'creates a prescription', re: /\binsert\s+into\s+(?:public\.)?prescriptions\b/i },
  {
    kind: 'confirms a prescription',
    re: /\bupdate\s+(?:public\.)?prescriptions\b[\s\S]*?\b(?:needs_review\s*=\s*false|field_review_status\s*=\s*'confirmed')/i,
  },
  { kind: 'requests a refill (D10)', re: /\binsert\s+into\s+(?:public\.)?refill_requests\b/i },
] as const;

/** The paths that exist today. Each must still be recognised, or the detector has gone blind. */
export const KNOWN_TRIGGERS = [
  'lib/data/pg/reads-rx.ts#savePrescriptionDraft',
  'lib/data/pg/agent.ts#insertExtractedPrescription',
  'lib/data/pg/writes.ts#confirmPrescriptionFields',
  'lib/data/pg/writes.ts#requestRefill',
] as const;

const SCREENING_CALLS = new Set(['screenOrHold', 'requestScreening']);
const TRANSACTIONS = new Set(['withSession', 'withAgent', 'withSystem']);

export interface Source { path: string; text: string }
export interface Unit { file: string; name: string; line: number; kinds: string[]; screens: boolean; insideTransaction: number[] }

function kindsOf(sqlText: string): string[] {
  return TRIGGER_KINDS.filter((k) => k.re.test(sqlText)).map((k) => k.kind);
}

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((s) => s.literal.text).join(' ');
  return null;
}

function unwrap(e: ts.Expression): ts.Expression {
  let x = e;
  while (ts.isAsExpression(x) || ts.isSatisfiesExpression(x) || ts.isParenthesizedExpression(x)) x = x.expression;
  return x;
}

/** `OBJ.key` and bare `CONST` names whose SQL text is a trigger statement, per file. */
function queryConstants(sf: ts.SourceFile): Map<string, string[]> {
  const out = new Map<string, string[]>();
  sf.forEachChild((stmt) => {
    if (!ts.isVariableStatement(stmt)) return;
    for (const d of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue;
      const init = unwrap(d.initializer);
      const own = literalText(init);
      if (own !== null) {
        const k = kindsOf(own);
        if (k.length) out.set(d.name.text, k);
      }
      if (ts.isObjectLiteralExpression(init)) {
        for (const p of init.properties) {
          if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) continue;
          const text = literalText(unwrap(p.initializer));
          if (text === null) continue;
          const k = kindsOf(text);
          if (k.length) out.set(`${d.name.text}.${p.name.text}`, k);
        }
      }
    }
  });
  return out;
}

function calleeName(call: ts.CallExpression): string | null {
  const c = call.expression;
  if (ts.isIdentifier(c)) return c.text;
  if (ts.isPropertyAccessExpression(c)) return c.name.text;
  return null;
}

/** Is this node inside a function passed to withSession / withAgent / withSystem? */
function inTransaction(node: ts.Node): boolean {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && p.parent && ts.isCallExpression(p.parent)) {
      const name = calleeName(p.parent);
      if (name && TRANSACTIONS.has(name) && p.parent.arguments.includes(p as ts.Expression)) return true;
    }
  }
  return false;
}

const parse = (src: Source) => ts.createSourceFile(src.path, src.text, ts.ScriptTarget.Latest, true, src.path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

function unitsOf(sf: ts.SourceFile, file: string, local: Map<string, string[]>): Unit[] {
  const units: Unit[] = [];
  const consider = (name: string, node: ts.Node) => {
    const kinds = new Set<string>();
    let screens = false;
    const insideTransaction: number[] = [];
    const visit = (n: ts.Node) => {
      const text = ts.isTaggedTemplateExpression(n) ? literalText(n.template) : literalText(n);
      if (text !== null) for (const k of kindsOf(text)) kinds.add(k);
      if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)) {
        for (const k of local.get(`${n.expression.text}.${n.name.text}`) ?? []) kinds.add(k);
      }
      if (ts.isIdentifier(n) && !(n.parent && ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)) {
        for (const k of local.get(n.text) ?? []) kinds.add(k);
      }
      if (ts.isCallExpression(n)) {
        const callee = calleeName(n);
        if (callee && SCREENING_CALLS.has(callee)) {
          if (inTransaction(n)) insideTransaction.push(sf.getLineAndCharacterOfPosition(n.getStart()).line + 1);
          else screens = true;
        }
      }
      n.forEachChild(visit);
    };
    visit(node);
    units.push({ file, name, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, kinds: [...kinds], screens, insideTransaction });
  };
  sf.forEachChild((stmt) => {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) consider(stmt.name.text, stmt);
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        const init = unwrap(d.initializer);
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) consider(d.name.text, init);
      }
    }
  });
  return units;
}

/** The pure check, over any set of sources (the test feeds it deliberately edited copies). */
export function check(sources: Source[]): GuardResult & { units: Unit[] } {
  // Query constants are resolved across every scanned file: lib/engine/doses.ts runs ENGINE_SQL from
  // lib/engine/sql.ts, and a statement moved into another file's constant must still be seen.
  const parsed = sources.map((s) => ({ file: s.path, sf: parse(s) }));
  const constants = new Map(parsed.flatMap((p) => [...queryConstants(p.sf)]));
  const units = parsed.flatMap((p) => unitsOf(p.sf, p.file, constants)).filter((u) => u.kinds.length > 0);
  const v: Violation[] = [];
  for (const u of units) {
    if (!u.screens) {
      v.push({ file: u.file, line: u.line, text: `${u.name} ${u.kinds.join(', ')} and never calls screenOrHold/requestScreening after its commit`, rule: 'screening on every path' });
    }
    for (const line of u.insideTransaction) {
      v.push({ file: u.file, line, text: `${u.name} calls screening inside its transaction, before the commit the agent must read back`, rule: 'screening after commit' });
    }
  }
  for (const k of TRIGGER_KINDS) {
    if (!units.some((u) => u.kinds.includes(k.kind))) {
      v.push({ file: SCOPE.join(', '), line: 0, text: `no function found that ${k.kind}`, rule: 'guard input missing' });
    }
  }
  for (const known of KNOWN_TRIGGERS) {
    const [file, name] = known.split('#');
    if (!units.some((u) => u.file === file && u.name === name)) {
      v.push({ file: file!, line: 0, text: `${name} is no longer recognised as a prescription write (moved, renamed, or hidden from the detector)`, rule: 'guard input missing' });
    }
  }
  const notes = [
    `${sources.length} file(s) scanned in ${SCOPE.join(', ')}; ${units.length} write path(s): ` +
      units.map((u) => `${u.name} (${u.screens ? 'screens' : 'DOES NOT SCREEN'})`).join(', '),
    'not scanned: lib/data/mock-impl.ts and lib/data/mock/** (the Phase 1 mock backend: no SQL, no screening agent, never production)',
  ];
  return { name: 'guard R · every prescription write and refill is screened after its commit (AP-10)', violations: v, notes, units };
}

export function run(): GuardResult {
  const files = SCOPE.flatMap((d) => walk(d, ['.ts', '.tsx']))
    .map(rel)
    .filter((f) => !/\.test\.tsx?$/.test(f) && !f.startsWith('lib/data/mock'));
  const { name, violations, notes } = check(files.map((path) => ({ path, text: readFileSync(path, 'utf8') })));
  return { name, violations, notes };
}
