/**
 * NEXUS 064: idempotent seed for a local, isolated and non-connected demonstration.
 * NO client data, WhatsApp pairing, remote services, user accounts, or productive DB.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";

const DEMO_EMAIL = "demo@nexus.invalid";
const DEMO_SESSION = "nexus_demo_session";
const DEMO_FLOW = "nexus_demo_first_flow";

function verifyLocalOnly() {
  assert.equal(process.env.NEXUS_DEMO_ONLY, "true", "Demo mode MUST be explicitly enabled.");
  const url = new URL(process.env.DATABASE_URL || "mysql://invalid/");
  assert.equal(url.protocol, "mysql:", "Only MySQL supported");
  assert.equal(url.hostname, "db", "Never seed a database outside local Docker Compose");
  assert.equal(url.pathname, "/nexus_demo", "Never seed a productive database");
  assert.equal(process.env.NEXUS_DEMO_EMAIL, DEMO_EMAIL, "Only fixed synthetic demo identity");
  const pass = process.env.NEXUS_DEMO_PASSWORD || "";
  assert.ok(pass.length >= 24, "Generate a private random demo password (>=24 characters)");
}
async function main() {
  verifyLocalOnly();
  try {
    const original = JSON.parse(readFileSync(new URL("./exemplo-marcflow-preview.json", import.meta.url), "utf8")).graph;
    const owner = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
    const count = await prisma.user.count();
    if (owner) {
      assert.equal(count, 1, "Refusing to continue with unknown users in demo DB");
      const session = await prisma.session.findUnique({ where: { sessionId: DEMO_SESSION } });
      assert.equal(session?.userId, owner.id, "Existing demo session does not belong to demo owner");
      assert.equal(session?.status, "DISCONNECTED", "Demo must never use connected WhatsApp sessions");
      const draft = await prisma.flow.findUnique({ where: { id: DEMO_FLOW } });
      assert.equal(draft?.sessionId, session.id, "Existing demo flow missing or not owned");
      assert.equal(draft?.status, "DRAFT", "Refusing demo start with an active flow");
      assert.equal(draft?.publishedGraph, null, "Refusing demo start with published content");
      console.log("NEXUS064_EXISTING_DRAFT_PRESERVED=true");
      return;
    }
    assert.equal(count, 0, "Refusing to seed a nonempty database");
    assert.equal(await prisma.session.count(), 0);
    assert.equal(await prisma.flow.count(), 0);
    const password = await bcrypt.hash(process.env.NEXUS_DEMO_PASSWORD!, 10);
    await prisma.$transaction(async tx => {
      const created = await tx.user.create({ data: {
        name: "NEXUS — Conta de demonstração", email: DEMO_EMAIL,
        password, role: "OWNER", apiKey: null,
      } });
      const session = await tx.session.create({ data: {
        name: "Sessão fictícia — WhatsApp desligado", sessionId: DEMO_SESSION,
        userId: created.id, status: "DISCONNECTED",
      } });
      await tx.flow.create({ data: {
        id: DEMO_FLOW, name: "Exemplo convertido — somente rascunho",
        sessionId: session.id, draftGraph: original,
        draftRevision: 0, publishedGraph: undefined, status: "DRAFT",
      } });
      await tx.systemConfig.upsert({
        where: { id: "default" },
        create: { id: "default", appName: "NEXUS — Demo local",
          enableRegistration: false, timezone: "America/Sao_Paulo" },
        update: { enableRegistration: false },
      });
    });
    console.log("NEXUS064_SYNTHETIC_MYSQL_SEED_PASS=true");
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(e => {
  console.error("NEXUS064_SEED_FAIL", e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
