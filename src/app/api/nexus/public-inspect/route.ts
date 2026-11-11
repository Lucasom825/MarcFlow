import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { inspectPublicRepo, fetchPublicGithub, PreflightError } from "@/lib/nexus-public-preflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A public-source-only PREVIEW. Never calls the REA engine or executes source. */
export async function GET(request: NextRequest) {
    if (process.env.NEXUS_DEMO_ONLY !== "true") {
        return NextResponse.json({ error: "Recurso experimental desabilitado." }, { status: 404 });
    }
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Faça login na demonstração." }, { status: 401 });
    }
    const target = request.nextUrl.searchParams.get("repo") ?? "";
    if (target.length > 250) {
        return NextResponse.json({ error: "Repositório inválido." }, { status: 400 });
    }
    try {
        const inspected = await inspectPublicRepo(target, fetchPublicGithub);
        return NextResponse.json(inspected, { status: 200, headers: { "Cache-Control": "private, no-store" } });
    } catch (err) {
        if (err instanceof PreflightError) {
            const status = ["INVALID_REPO","INVALID_SHA","INVALID_BRANCH","TREE_INCOMPLETE","SIZE_LIMIT","ARCHIVED"].includes(err.code) ? 400
                : err.code === "NOT_FOUND" ? 404 : err.code === "RATE_LIMIT" ? 429 : err.code === "NOT_PUBLIC" ? 403 : 502;
            return NextResponse.json({ error: err.message, code: err.code }, { status, headers: { "Cache-Control": "no-store" } });
        }
        return NextResponse.json({ error: "Não foi possível consultar o GitHub com segurança." }, { status: 502 });
    }
}
