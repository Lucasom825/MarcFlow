// NEXUS 062: seed *only* a disposable local MySQL GitHub Actions database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";

export const SESSION = "nexus062_test_session";
export const FLOW = "nexus062_test_flow";
export const OTHER_SESSION = "nexus062_other_session";
export const OWNER_KEY = "nexus062_owner_key_disposable_not_secret";
export const OTHER_KEY = "nexus062_other_key_disposable_not_secret";
const seed = JSON.parse(readFileSync(new URL("./exemplo-marcflow-preview.json", import.meta.url), "utf8")).graph;

function guard() {
  assert.equal(process.env.NEXUS062_EPHEMERAL_ONLY, "true", "CI-only run required");
  const db = new URL(process.env.DATABASE_URL || "mysql://invalid/");
  assert.equal(db.protocol, "mysql:", "Expected MySQL");
  assert.equal(db.hostname, "127.0.0.1", "Only loopback DB allowed");
  assert.equal(db.pathname, "/nexus062", "Only disposable database allowed");
}
async function main() {
  guard();
  try {
    assert.equal(await prisma.user.count(), 0, "Refuse nonempty database");
    assert.equal(await prisma.flow.count(), 0, "Refuse existing flows");
    const owner = await prisma.user.create({
      data: {
        email: "nexus062-owner@example.invalid", name: "NEXUS062 synthetic owner",
        role: "OWNER", password: "NOT_A_REAL_PASSWORD_062",
        apiKey: OWNER_KEY,
      },
    });
    const other = await prisma.user.create({
      data: {
        email: "nexus062-other@example.invalid", name: "NEXUS062 synthetic other",
        role: "OWNER", password: "NOT_A_REAL_PASSWORD_062",
        apiKey: OTHER_KEY,
      },
    });
    const session = await prisma.session.create({ data: {
      sessionId: SESSION, userId: owner.id, name: "NEXUS062 offline fixture", status: "DISCONNECTED",
    }});
    const otherSession = await prisma.session.create({ data: {
      sessionId: OTHER_SESSION, userId: other.id, name: "NEXUS062 other user's fixture", status: "DISCONNECTED",
    }});
    await prisma.flow.create({ data: {
      id: FLOW, sessionId: session.id, name: "NEXUS 062 — teste sem WhatsApp",
      status: "DRAFT", draftGraph: seed, draftRevision: 0,
    }});
    await prisma.flow.create({ data: {
      id: "nexus062_other_flow", sessionId: otherSession.id,
      name: "Other owner's flow fixture", status: "DRAFT",
      draftGraph: seed, draftRevision: 0,
    }});
    const flow = await prisma.flow.findUniqueOrThrow({where:{id:FLOW}});
    assert.equal(flow.draftRevision, 0);
    assert.equal(flow.publishedGraph, null);
    assert.equal(flow.status, "DRAFT");
    console.log("NEXUS062_SYNTHETIC_SEED_PASS=true");
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(e => { console.error("NEXUS062_SEED_FAILED", e.message); process.exitCode = 1; });
