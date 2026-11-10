import { auth } from "@/lib/auth";
import { allowNexusDemoApi } from "@/lib/nexus-demo-policy";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Explicit private demo mode: block any unrelated API route before Auth.js
    // and the normal API-key/session authorization paths. No default changes.
    if (process.env.NEXUS_DEMO_ONLY === "true" && pathname.startsWith("/api/") &&
        !allowNexusDemoApi(pathname, request.method)) {
        return NextResponse.json(
            { status: false, message: "Ação desativada na demonstração local do NEXUS." },
            { status: 403 }
        );
    }

    // Public routes that don't require authentication
    const publicRoutes = ["/auth/login", "/auth/register", "/api/auth", "/api/test", "/terms", "/privacy"];

    // Check if it's a public route
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    // Allow Next.js internals and favicon only
    if (
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico"
    ) {
        return NextResponse.next();
    }

    // Allow known static asset extensions in root path only (e.g. /vercel.svg)
    const staticExtensions = [".svg", ".ico", ".png", ".jpg", ".jpeg", ".webp", ".woff", ".woff2", ".ttf"];
    if (pathname.lastIndexOf("/") === 0 && staticExtensions.some(ext => pathname.endsWith(ext))) {
        return NextResponse.next();
    }

    // API routes: Check for API key or session
    if (pathname.startsWith("/api/")) {
        // Skip auth endpoints
        if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/test")) {
            return NextResponse.next();
        }

        // Check for API key in header
        const apiKey = request.headers.get("x-api-key");
        if (apiKey) {
            // API key auth will be validated in the route handler
            return NextResponse.next();
        }

        // Check for session auth
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.next();
    }

    // Dashboard routes: Require login
    if (pathname.startsWith("/dashboard")) {
        const session = await auth();

        if (!session?.user) {
            const loginUrl = new URL("/auth/login", request.url);
            loginUrl.searchParams.set("callbackUrl", pathname);
            return NextResponse.redirect(loginUrl);
        }

        return NextResponse.next();
    }

    // Root path — redirect to dashboard if logged in
    if (pathname === "/") {
        const session = await auth();
        if (session?.user) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }
        return NextResponse.next();
    }

    // Public routes
    if (isPublicRoute) {
        const session = await auth();
        if (session?.user && (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/register"))) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }
        return NextResponse.next();
    }

    // Default: require auth for everything else
    const session = await auth();
    if (!session?.user) {
        const loginUrl = new URL("/auth/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
