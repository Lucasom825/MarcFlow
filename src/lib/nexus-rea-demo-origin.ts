/**
 * NEXUS 071 hotfix: Codespaces terminates HTTPS before forwarding to Next.js.
 * request.nextUrl.origin can therefore be the INTERNAL container origin.
 * Compare browser Origin ONLY against trusted server AUTH_URL, not proxy headers.
 */
export function isAuthorizedReaDemoOrigin(
  browserOrigin: string | null,
  configuredPublicUrl: string | undefined
): boolean {
  if (!browserOrigin || !configuredPublicUrl) return false;
  try {
    const trusted = new URL(configuredPublicUrl);
    if(trusted.username || trusted.password || trusted.search || trusted.hash ||
       trusted.pathname !== "/") return false;
    if(trusted.protocol !== "https:" &&
       !(trusted.protocol === "http:" &&
         (trusted.hostname === "localhost" || trusted.hostname === "127.0.0.1"))) return false;

    const caller = new URL(browserOrigin);
    if(browserOrigin !== caller.origin ||
       caller.username || caller.password || caller.pathname !== "/" ||
       caller.search || caller.hash) return false;
    return caller.origin === trusted.origin;
  } catch { return false; }
}
