// NEXUS 061 - integration proof using real MarcFlow API handlers + real Prisma MySQL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { prisma } from '../../src/lib/prisma';
import { PUT as saveDraft } from '../../src/app/api/flows/[sessionId]/[flowId]/draft/route';
import { GET as readFlow } from '../../src/app/api/flows/[sessionId]/[flowId]/route';
import { validateGraph, type FlowGraph } from '../../src/modules/flows/types';

type ApiOutput = { status?: boolean; message?: string; data?: Record<string, any> };
const original: FlowGraph = JSON.parse(readFileSync(new URL('./exemplo-marcflow-preview.json', import.meta.url), 'utf8')).graph;
const copy = <T>(x: T): T => structuredClone(x);
const mkGraph = (s: string): FlowGraph => {
  const g = copy(original);
  const c = g.nodes.find(n => n.type === 'content')!;
  c.data.items = [{ id: 't1', kind: 'text', text: s }];
  return g;
};
const context = (sessionId: string, flowId: string) => ({ params: Promise.resolve({ sessionId, flowId }) });
const apiKey = (key: string) => ({ 'x-api-key': key });
function request(method: string, sessionId: string, flowId: string, key: string, payload?: unknown) {
  const url = `http://127.0.0.1:39161/api/flows/${sessionId}/${flowId}${method === 'PUT' ? '/draft' : ''}`;
  const headers = new Headers({ ...apiKey(key), 'Content-Type': 'application/json' });
  return new NextRequest(url, {
    method,
    headers,
    ...(payload === undefined ? {} : { body: typeof payload === 'string' ? payload : JSON.stringify(payload) }),
  });
}
async function call(method: 'GET'|'PUT', sessionId: string, flowId: string, key: string, payload?: unknown) {
  const req = request(method, sessionId, flowId, key, payload);
  const args = context(sessionId, flowId);
  const res = method === 'GET' ? await readFlow(req, args) : await saveDraft(req, args);
  return { code: res.status, json: await res.json() as ApiOutput };
}
let tests = 0;
function prove(name: string, fn: () => void) {
  try { fn(); tests++; console.log('NEXUS061_PASS ' + name); }
  catch (err) { console.error('NEXUS061_FAIL ' + name); throw err; }
}
async function main() {
  assert.equal(process.env.NEXUS061_EPHEMERAL_ONLY, 'true', 'Refusing to run outside ephemeral CI proof');
  const url = new URL(process.env.DATABASE_URL || 'http://invalid/');
  assert.equal(url.hostname, '127.0.0.1', 'Refusing non-local database.');
  assert.equal(url.pathname, '/nexus061', 'Refusing non-ephemeral database name.');
  let ownerId = '', sessionId = '', flowId = '', otherSessionId = '', otherFlowId = '';
  const KEY = 'nexus061_owner_test_only_key';
  const OTHER_KEY = 'nexus061_other_test_only_key';
  try {
    const owner = await prisma.user.create({ data: {
      email: 'nexus061-owner@example.invalid', name: 'NEXUS061 OWNED SYNTHETIC',
      password: 'NOT_FOR_LOGIN_061', role: 'OWNER', apiKey: KEY,
    } });
    ownerId = owner.id;
    const otherUser = await prisma.user.create({ data: {
      email: 'nexus061-other@example.invalid', name: 'NEXUS061 ISOLATED SYNTHETIC',
      password: 'NOT_FOR_LOGIN_061', role: 'OWNER', apiKey: OTHER_KEY,
    } });
    const ownedSession = await prisma.session.create({ data: {
      name: 'Synthetic offline session', sessionId: 'NEXUS061_OWNER_SESSION', userId: owner.id,
      status: 'DISCONNECTED',
    }});
    const otherSession = await prisma.session.create({ data: {
      name: 'Other synthetic offline session', sessionId: 'NEXUS061_OTHER_SESSION',
      userId: otherUser.id, status: 'DISCONNECTED',
    }});
    sessionId = ownedSession.sessionId;
    otherSessionId = otherSession.sessionId;
    const flow = await prisma.flow.create({ data: {
      name: 'NEXUS061 Synthetic Draft', sessionId: ownedSession.id, draftGraph: original as object,
      draftRevision: 0, status: 'DRAFT',
    }});
    const otherFlow = await prisma.flow.create({ data: {
      name: 'Other user fixture', sessionId: otherSession.id, draftGraph: original as object,
      draftRevision: 0, status: 'DRAFT',
    }});
    flowId = flow.id;
    otherFlowId = otherFlow.id;
    prove('real database schema and fixture created', () => {
      assert.equal(flow.draftRevision, 0);
      assert.equal(otherSession.status, 'DISCONNECTED');
      assert.equal(flow.publishedGraph, null);
    });

    const firstRead = await call('GET', sessionId, flowId, KEY);
    prove('real GET returns initial draftGraph and revision zero', () => {
      assert.equal(firstRead.code, 200);
      assert.deepEqual(firstRead.json.data?.draftGraph, original);
      assert.equal(firstRead.json.data?.draftRevision, 0);
    });

    const validOne = mkGraph('Primeira alteração gravada em MySQL');
    assert.equal(validateGraph(validOne).filter(i => i.level === 'error').length, 0);
    const saved = await call('PUT', sessionId, flowId, KEY, { graph: validOne, revision: 0 });
    prove('real PUT persists graph and returns revision one', () => {
      assert.equal(saved.code, 200);
      assert.equal(saved.json.data?.revision, 1);
    });

    let onDisk = await prisma.flow.findUniqueOrThrow({ where: { id: flowId } });
    prove('Prisma reads committed graph and revision', () => {
      assert.deepEqual(onDisk.draftGraph, validOne);
      assert.equal(onDisk.draftRevision, 1);
      assert.equal(onDisk.status, 'DRAFT');
      assert.equal(onDisk.publishedGraph, null);
    });

    const afterRead = await call('GET', sessionId, flowId, KEY);
    prove('real GET returns saved graph after roundtrip', () => {
      assert.equal(afterRead.code, 200);
      assert.deepEqual(afterRead.json.data?.draftGraph, validOne);
      assert.equal(afterRead.json.data?.draftRevision, 1);
    });

    const stale = await call('PUT', sessionId, flowId, KEY, { graph: original, revision: 0 });
    prove('stale second tab receives HTTP 409 and current revision', () => {
      assert.equal(stale.code, 409);
      assert.equal(stale.json.data?.revision, 1);
    });
    onDisk = await prisma.flow.findUniqueOrThrow({ where: { id: flowId } });
    prove('stale revision did not overwrite first saved draft', () => {
      assert.deepEqual(onDisk.draftGraph, validOne);
      assert.equal(onDisk.draftRevision, 1);
    });

    const [raceA, raceB] = await Promise.all([
      call('PUT', sessionId, flowId, KEY, { graph: mkGraph('A venceu'), revision: 1 }),
      call('PUT', sessionId, flowId, KEY, { graph: mkGraph('B venceu'), revision: 1 }),
    ]);
    prove('simultaneous PUTs have exactly one winner, one conflict', () => {
      assert.deepEqual([raceA.code, raceB.code].sort(), [200, 409]);
      assert.deepEqual([raceA.json.data?.revision, raceB.json.data?.revision].sort(), [2, 2]);
    });
    onDisk = await prisma.flow.findUniqueOrThrow({ where: { id: flowId } });
    prove('concurrent commit increments exactly once and is not torn', () => {
      assert.equal(onDisk.draftRevision, 2);
      assert.ok(['A venceu', 'B venceu'].some(s => JSON.stringify(onDisk.draftGraph).includes(s)));
    });

    const crossRead = await call('GET', otherSessionId, otherFlowId, KEY);
    prove('real authentication rejects read of a separate user session', () => { assert.equal(crossRead.code, 403); });

    const crossWrite = await call('PUT', otherSessionId, otherFlowId, KEY, { graph: validOne, revision: 0 });
    prove('real authentication rejects write to another user session', () => { assert.equal(crossWrite.code, 403); });

    const unknownFlow = await call('GET', sessionId, 'nexus061-unknown-flow', KEY);
    prove('real API denies nonexistent flow', () => { assert.equal(unknownFlow.code, 404); });

    const badJson = await call('PUT', sessionId, flowId, KEY, '{"graph":');
    prove('malformed JSON returns HTTP 400, not a database write', () => { assert.equal(badJson.code, 400); });

    const noStart = await call('PUT', sessionId, flowId, KEY, {
      graph: { nodes: validOne.nodes.filter(n => n.type !== 'start'), edges: [] }, revision: 2
    });
    prove('start node cannot be removed in draft API', () => { assert.equal(noStart.code, 400); });

    const oversized = await call('PUT', sessionId, flowId, KEY, 'x'.repeat(2_000_010));
    prove('oversize request returns HTTP 413', () => { assert.equal(oversized.code, 413); });

    onDisk = await prisma.flow.findUniqueOrThrow({ where: { id: flowId } });
    prove('bad payloads did not increment the stored revision', () => { assert.equal(onDisk.draftRevision, 2); });

    // Restoration is an intentional NEW version, not transactional rollback of other users.
    const restored = await call('PUT', sessionId, flowId, KEY, { graph: validOne, revision: 2 });
    prove('restore previous known-good graph creates a new revision', () => {
      assert.equal(restored.code, 200);
      assert.equal(restored.json.data?.revision, 3);
    });
    onDisk = await prisma.flow.findUniqueOrThrow({ where: { id: flowId } });
    prove('restored graph matches known good snapshot and stays unpublished', () => {
      assert.deepEqual(onDisk.draftGraph, validOne);
      assert.equal(onDisk.draftRevision, 3);
      assert.equal(onDisk.publishedGraph, null);
      assert.equal(onDisk.status, 'DRAFT');
    });

    // Robustness gate: malformed revision must be rejected gracefully.
    // Existing production route may throw here; failure exposes actual gap.
    let invalidRevision: {code:number;json:ApiOutput}|null = null;
    let exception: unknown = null;
    try {
      invalidRevision = await call('PUT', sessionId, flowId, KEY, { graph: validOne, revision: 'not-an-integer' });
    } catch (e) { exception = e; }
    prove('malformed revision must return HTTP 400 without uncaught exception', () => {
      if (exception) throw new Error('Unexpected uncaught invalid revision exception: ' + (exception as Error).message.slice(0,240));
      assert.equal(invalidRevision?.code, 400);
    });

    // These inputs could be coerced by Number(...) in the old route.
    const invalidValues: [string, unknown][] = [
      ['numeric string', '3'],
      ['null', null],
      ['negative', -1],
      ['fraction', 1.5],
      ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
    ];
    for (const [label, revision] of invalidValues) {
      const invalid = await call('PUT', sessionId, flowId, KEY, { graph: validOne, revision });
      prove('revision schema rejects ' + label, () => { assert.equal(invalid.code, 400); });
    }
    const unicodeOverflow = await call('PUT', sessionId, flowId, KEY,
      JSON.stringify({ graph: validOne, revision: 3, extra: '😀'.repeat(560_000) }));
    prove('UTF-8 byte limit rejects multibyte payload > 2 MB even with fewer code units', () => {
      assert.equal(unicodeOverflow.code, 413);
    });

    const last = await prisma.flow.findUniqueOrThrow({ where: { id: flowId } });
    prove('invalid revision left stored draft unchanged', () => {
      assert.equal(last.draftRevision, 3);
      assert.deepEqual(last.draftGraph, validOne);
    });
    console.log(`NEXUS061_ALL_PASS=${tests}`);
    console.log('NEXUS061_TRUE_MYSQL_API_ROUTE=true');
    console.log('NEXUS061_NO_PRODUCTION_DATABASE=true');
  } finally {
    const _ = { ownerId, sessionId, flowId, otherSessionId, otherFlowId };
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error('NEXUS061_INTEGRATION_FAILED', String(error?.stack ?? error).slice(0,2000)); process.exitCode = 1; });
