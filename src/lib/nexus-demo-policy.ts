/**
 * NEXUS 064 — allowlist for a PRIVATE, loopback-only and synthetic MarcFlow demo.
 *
 * Production behavior is unchanged unless NEXUS_DEMO_ONLY=true is explicitly set.
 * Never permits broadcasting, session creation, WhatsApp, publish/activate, updates,
 * settings changes, imports, or any mutation outside a draft in the demo session.
 */
export const DEMO_SESSION_ID = "nexus_demo_session";
const FLOW = /^\/api\/flows\/nexus_demo_session(?:\/([^/]+))?(?:\/(draft|meta))?$/;

export function allowNexusDemoApi(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  // Credentials Auth.js routes only. New account registration must remain closed.
  if (pathname === "/api/auth/register" || pathname.startsWith("/api/auth/register/")) return false;
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return m === "GET" || m === "POST";
  }
  if (pathname === "/api/sessions" || pathname === "/api/notifications") {
    return m === "GET";
  }
  const match = FLOW.exec(pathname);
  if (!match) return false;
  const flowId = match[1], subroute = match[2];
  if (!flowId && !subroute) return m === "GET" || m === "POST"; // create draft only
  if (!flowId || flowId.length > 160) return false;
  if (!subroute) return m === "GET"; // read draft only; no rename, activate, or delete
  if (subroute === "meta") return m === "GET";
  if (subroute === "draft") return m === "PUT";
  return false;
}
