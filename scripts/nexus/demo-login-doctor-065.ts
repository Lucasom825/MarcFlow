/**
 * NEXUS 065: diagnose demo login and (only on explicit 'repair') align a local
 * synthetic account's bcrypt password with the local .env.nexus-demo password.
 *
 * NEVER creates/deletes users or tables; NEVER touches flows or sessions.
 * For the Docker Compose lab at db/nexus_demo only. Does not print secrets.
 */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";

function guard() {
  assert.equal(process.env.NEXUS_DEMO_ONLY, "true", "Explicit demo flag required");
  assert.equal(process.env.NEXUS_DEMO_EMAIL, "demo@nexus.invalid", "Demo identity only");
  const url = new URL(process.env.DATABASE_URL || "mysql://invalid/");
  assert.equal(url.protocol, "mysql:");
  assert.equal(url.hostname, "db", "Refusing non-Docker database");
  assert.equal(url.pathname, "/nexus_demo", "Refusing non-demo database");
  const password = process.env.NEXUS_DEMO_PASSWORD || "";
  assert.ok(password.length >= 24, "Missing valid local demo password");
  return password;
}

async function main() {
  const command = process.argv[2];
  assert.ok(command === "check" || command === "repair",
    "Use check (read-only) or repair (changes ONLY synthetic password with explicit approval)");
  const newPassword = guard();

  try {
    const [users, sessions, flows, config] = await Promise.all([
      prisma.user.findMany({select:{id:true,email:true,password:true,role:true,apiKey:true}}),
      prisma.session.findMany({select:{id:true,sessionId:true,userId:true,status:true}}),
      prisma.flow.findMany({select:{id:true,sessionId:true,status:true,publishedGraph:true}}),
      prisma.systemConfig.findUnique({where:{id:"default"}}),
    ]);
    assert.equal(users.length, 1, "Refusing unknown-user database");
    assert.equal(users[0].email, "demo@nexus.invalid");
    assert.equal(users[0].role, "OWNER");
    assert.equal(users[0].apiKey, null, "API-key user is not a demo account");
    assert.equal(sessions.length, 1, "Refusing multiple or unexpected sessions");
    assert.equal(sessions[0].sessionId, "nexus_demo_session");
    assert.equal(sessions[0].userId, users[0].id);
    assert.equal(sessions[0].status, "DISCONNECTED", "WhatsApp-connected session found");
    assert.ok(flows.length >= 1, "Demo graph missing");
    assert.ok(flows.some(f=>f.id==="nexus_demo_first_flow"), "Demo reference graph missing");
    assert.ok(flows.every(f => f.sessionId === sessions[0].id &&
      f.status === "DRAFT" && f.publishedGraph === null),
      "Refusing login repair with active or published content");
    assert.equal(config?.enableRegistration, false, "Public registration must remain disabled");

    const valid = await bcrypt.compare(newPassword, users[0].password);
    if (valid) {
      console.log("NEXUS065_LOCAL_LOGIN_CREDENTIALS_MATCH=true");
      console.log("NEXUS065_DEMO_DRAFTS_UNTOUCHED=true");
      return;
    }
    console.log("NEXUS065_LOCAL_LOGIN_CREDENTIALS_MISMATCH=true");
    if (command === "check") {
      console.log("NEXUS065_REPAIR_NOT_RUN=read_only");
      return;
    }
    // Only on a deliberate 'repair' command, update password hash for the
    // single known synthetic account. No user creation, data reset, or exposure.
    const hash = await bcrypt.hash(newPassword, 12);
    const changed = await prisma.user.updateMany({
      where: { id:users[0].id, password:users[0].password },
      data: { password: hash },
    });
    assert.equal(changed.count,1,"Demo password changed concurrently; no overwrite");
    const updated = await prisma.user.findUniqueOrThrow({where:{id:users[0].id}});
    assert.equal(await bcrypt.compare(newPassword,updated.password),true);
    console.log("NEXUS065_LOCAL_DEMO_PASSWORD_REPAIRED=true");
    console.log("NEXUS065_DEMO_DRAFTS_UNTOUCHED=true");
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(error => {
  console.error("NEXUS065_DIAGNOSIS_FAILED",
    error instanceof Error ? error.message : "unexpected error");
  process.exitCode = 1;
});
