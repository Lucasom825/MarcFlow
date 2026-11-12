import {NextRequest,NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {validateRea070Request,dispatchRea070,reaDispatchReady,Rea070Error}
  from "@/lib/nexus-rea-general-070";
import {PreflightError} from "@/lib/nexus-public-preflight";
import {diagnoseReaDemoOrigin} from "@/lib/nexus-rea-demo-origin";
import {checkReaCsrfPolicy} from "@/lib/nexus-rea-csrf-071";
export const runtime="nodejs"; export const dynamic="force-dynamic";
const cooldown=new Map<string,number>();
export async function POST(request:NextRequest){
  if(process.env.NEXUS_DEMO_ONLY!=="true")return NextResponse.json({error:"Indisponível."},{status:404});
  const session=await auth();
  if(session?.user?.email?.toLowerCase()!=="demo@nexus.invalid")
    return NextResponse.json({error:"Login de demonstração exigido."},{status:401});
  // The public origin is set once by the trusted Codespaces bootstrap.
  // Auth.js's AUTH_URL may be auto-derived from proxy headers and must NOT
  // be used as the independent CSRF allowlist. Never trust browser Host,
  // forwarded headers or user-controlled URLs to authorize GitHub dispatch.
  const originDiagnostic=diagnoseReaDemoOrigin(
    request.headers.get("origin"),process.env.NEXUS_REA_ALLOWED_ORIGIN);
  const proofStatus=checkReaCsrfPolicy({
    originStatus:originDiagnostic,
    fetchSite:request.headers.get("sec-fetch-site"),
    fetchMode:request.headers.get("sec-fetch-mode"),
    fetchDest:request.headers.get("sec-fetch-dest"),
    proof:request.headers.get("x-nexus-rea-proof"),
    userId:String(session.user.id??""),
    trustedOrigin:process.env.NEXUS_REA_ALLOWED_ORIGIN,
    secret:process.env.AUTH_SECRET
  });
  if(proofStatus!=="CSRF_OK")
    return NextResponse.json({
      error:"Solicitação não autorizada pela proteção do navegador.",
      code:proofStatus,
      origin_code:originDiagnostic,
      diagnostic_version:"NEXUS071_CSRF_4"
    },{status:403,headers:{"Cache-Control":"private, no-store","Vary":"Origin, Sec-Fetch-Site"}});
  // Origin mismatch caused by a proxy is tolerated ONLY with the signed proof,
  // a valid Auth.js demo session, and same-origin browser Fetch Metadata.
  // No cross-site, missing header, forged origin or simple-form fallback.
  if(!reaDispatchReady())
    return NextResponse.json({error:"A autorização segura do GitHub Actions não foi conectada ao servidor."},{status:503});
  if(Number(request.headers.get("content-length")||0)>2000)
    return NextResponse.json({error:"Solicitação grande demais."},{status:413});
  const id=String(session.user.id??session.user.email);
  const now=Date.now();
  if(now-(cooldown.get(id)||0)<120000)
    return NextResponse.json({error:"Aguarde antes de solicitar outra análise para preservar a cota GitHub."},{status:429});
  try{
    let input:unknown;
    try{input=await request.json();}catch{throw new Rea070Error("INVALID_INPUT","JSON inválido.");}
    const target=await validateRea070Request(input);
    // Add throttle BEFORE dispatch to avoid repeated attempts on HTTP timeouts.
    cooldown.set(id,now);
    const result=await dispatchRea070(target);
    return NextResponse.json(result,{status:202,headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    if(error instanceof Rea070Error){
      const status=error.code==="INVALID_INPUT" || error.code==="INVALID_DIRECTORY" ||
        error.code==="STALE_COMMIT" || error.code==="LICENSE_NOT_ALLOWED"?400:
        error.code==="NOT_CONFIGURED"?503:502;
      return NextResponse.json({error:error.message,code:error.code},{status});
    }
    if(error instanceof PreflightError)return NextResponse.json({error:error.message,code:error.code},{status:400});
    return NextResponse.json({error:"Não foi possível solicitar a análise. Confira a conexão."},{status:502});
  }
}
