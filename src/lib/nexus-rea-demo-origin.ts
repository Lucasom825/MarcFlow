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


/**
 * The browser and server will see only a symbolic failure reason; never report
 * full browser referrers, cookies, tokens or the private Codespaces address.
 */
export type ReaOriginDiagnostic =
  "ORIGIN_OK" | "ORIGIN_HEADER_MISSING" | "AUTH_URL_MISSING" |
  "AUTH_URL_INVALID" | "BROWSER_ORIGIN_INVALID" | "ORIGIN_MISMATCH";

export function diagnoseReaDemoOrigin(
  browserOrigin: string | null,
  configuredPublicUrl: string | undefined
): ReaOriginDiagnostic {
  if(!configuredPublicUrl) return "AUTH_URL_MISSING";
  if(!browserOrigin) return "ORIGIN_HEADER_MISSING";
  let trusted:URL,caller:URL;
  try{trusted=new URL(configuredPublicUrl);}
  catch{return "AUTH_URL_INVALID";}
  if(trusted.username || trusted.password || trusted.search || trusted.hash ||
     trusted.pathname!=="/" ||
     (trusted.protocol!=="https:" && !(trusted.protocol==="http:" &&
       (trusted.hostname==="localhost" || trusted.hostname==="127.0.0.1"))))
    return "AUTH_URL_INVALID";
  try{caller=new URL(browserOrigin);}
  catch{return "BROWSER_ORIGIN_INVALID";}
  if(caller.username || caller.password || caller.search || caller.hash ||
     caller.pathname!=="/" || browserOrigin!==caller.origin)
    return "BROWSER_ORIGIN_INVALID";
  if(caller.origin!==trusted.origin)return "ORIGIN_MISMATCH";
  return "ORIGIN_OK";
}


/**
 * Only authenticated demo users can receive the exact bootstrap-approved
 * Codespaces URL. It is a navigation hint, never an authority override.
 * The POST CSRF check still requires the browser's actual Origin to match.
 */
export function canonicalReaDemoPage(configuredPublicUrl:string|undefined):string|null {
  if(!configuredPublicUrl) return null;
  if(diagnoseReaDemoOrigin(configuredPublicUrl,configuredPublicUrl)!=="ORIGIN_OK")return null;
  const url=new URL(configuredPublicUrl);
  // This pilot is bound to the forwarded Codespaces demo port. No arbitrary redirect.
  if(url.protocol!=="https:" || !/^[a-z0-9-]+-39164\.app\.github\.dev$/.test(url.hostname) ||
     url.port || url.username || url.password)return null;
  return url.origin+"/dashboard/nexus/rea";
}
