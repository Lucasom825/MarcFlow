/**
 * NEXUS 071.4: CSRF proof for state-changing REA dispatch behind Codespaces.
 * HTTPS proxies can transform Origin. Do NOT disable CSRF. Require a
 * server-signed, short-lived, user-bound proof and same-origin Fetch Metadata.
 */
import {createHmac,timingSafeEqual} from "node:crypto";
import {diagnoseReaDemoOrigin} from "@/lib/nexus-rea-demo-origin";

const VERSION="v1";
const WINDOW_MS=10*60*1000;
const TOKEN_RE=/^v1\.([1-9][0-9]{0,12})\.([a-f0-9]{64})$/;
const MAX_TOKEN_LENGTH=100;

function trustworthyConfig(origin:string|undefined,secret:string|undefined,userId:string|undefined){
  if(!origin || !secret || secret.length<24 || !userId || userId.length>256)return false;
  return diagnoseReaDemoOrigin(origin,origin)==="ORIGIN_OK";
}

function sign(userId:string,origin:string,slot:number,secret:string):string{
  return createHmac("sha256",secret)
    .update("NEXUS_REA_DISPATCH_CSRF_V1\0")
    .update(userId).update("\0").update(origin).update("\0").update(String(slot))
    .digest("hex");
}

export function makeReaCsrfProof(
 userId:string|undefined,
 origin:string|undefined=process.env.NEXUS_REA_ALLOWED_ORIGIN,
 secret:string|undefined=process.env.AUTH_SECRET,
 now:number=Date.now()
):string|null {
 if(!trustworthyConfig(origin,secret,userId)||!Number.isFinite(now)||now<WINDOW_MS)return null;
 const slot=Math.floor(now/WINDOW_MS);
 return VERSION+"."+slot+"."+sign(userId!,origin!,slot,secret!);
}
export function verifyReaCsrfProof(
 token:string|null,
 userId:string|undefined,
 origin:string|undefined=process.env.NEXUS_REA_ALLOWED_ORIGIN,
 secret:string|undefined=process.env.AUTH_SECRET,
 now:number=Date.now()
):boolean {
 if(!trustworthyConfig(origin,secret,userId) ||
    !token || token.length>MAX_TOKEN_LENGTH || !Number.isFinite(now))return false;
 const m=token.match(TOKEN_RE);
 if(!m)return false;
 const slot=Number(m[1]),current=Math.floor(now/WINDOW_MS);
 if(!Number.isSafeInteger(slot)||slot>current||slot<current-1)return false;
 const expected=Buffer.from(sign(userId!,origin!,slot,secret!),"hex");
 const supplied=Buffer.from(m[2],"hex");
 return supplied.length===expected.length && timingSafeEqual(supplied,expected);
}

export type ReaCsrfPolicyStatus=
 "CSRF_OK"|"FETCH_SITE_UNTRUSTED"|"FETCH_MODE_UNTRUSTED"|
 "CSRF_PROOF_MISSING"|"CSRF_PROOF_INVALID";

/**
 * A proxy-related Origin mismatch is acceptable ONLY when a valid session-
 * bound proof and browser Fetch Metadata independently prove same-origin.
 * Browser scripts cannot forge Sec-Fetch-Site; cross-origin fetches cannot
 * read authenticated config or send arbitrary custom headers without CORS.
 */
export function checkReaCsrfPolicy(args:{
 originStatus:string;fetchSite:string|null;fetchMode:string|null;
 fetchDest:string|null;proof:string|null;userId:string|undefined;
 trustedOrigin:string|undefined;secret:string|undefined;now?:number
}):ReaCsrfPolicyStatus {
 const {originStatus,fetchSite,fetchMode,fetchDest,proof,userId,trustedOrigin,secret,now}=args;
 if(fetchSite!=="same-origin")return "FETCH_SITE_UNTRUSTED";
 if(fetchMode!=="cors"||fetchDest!=="empty")return "FETCH_MODE_UNTRUSTED";
 if(!proof)return "CSRF_PROOF_MISSING";
 if(!verifyReaCsrfProof(proof,userId,trustedOrigin,secret,now))return "CSRF_PROOF_INVALID";
 if(originStatus!=="ORIGIN_OK"&&originStatus!=="ORIGIN_MISMATCH")return "CSRF_PROOF_INVALID";
 return "CSRF_OK";
}
