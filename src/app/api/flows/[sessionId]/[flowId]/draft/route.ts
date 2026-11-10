import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveFlow } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string; flowId: string }> };
const MAX_BYTES = 2_000_000;

/** Saves the whole draft graph with optimistic concurrency: the client sends the revision it last saw. */
export async function PUT(request: NextRequest, { params }: P) {
    const { sessionId, flowId } = await params;
    const r = await resolveFlow(request, sessionId, flowId);
    if (r instanceof NextResponse) return r;
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) return fail("Fluxo grande demais", 413);
    let body: { graph?: { nodes?: unknown; edges?: unknown }; revision?: number } | null;
    try { body = JSON.parse(raw); } catch { return fail("JSON inválido"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("JSON inválido", 400);
    const revision = body.revision;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0 || revision > 2_147_483_646) return fail("Revisão inválida", 400);
    const g = body.graph;
    if (!g || typeof g !== "object" || Array.isArray(g) || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) return fail("Grafo inválido");
    if (![...g.nodes, ...g.edges].every(item => item !== null && typeof item === "object" && !Array.isArray(item))) return fail("Grafo inválido");
    if (!(g.nodes as { type?: string }[]).some(n => n.type === "start")) return fail("O bloco inicial não pode ser removido");

    const res = await prisma.flow.updateMany({
        where: { id: flowId, draftRevision: revision },
        data: { draftGraph: g as object, draftRevision: { increment: 1 } },
    });
    if (res.count === 0) {
        const cur = await prisma.flow.findUnique({ where: { id: flowId }, select: { draftRevision: true } });
        return fail("O fluxo foi alterado em outra aba. Recarregue para ver a versão mais recente.", 409, { revision: cur?.draftRevision });
    }
    return ok({ revision: revision + 1 }, "Salvo");
}
