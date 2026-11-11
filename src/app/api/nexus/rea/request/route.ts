import {NextRequest,NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {validateRea070Request,dispatchRea070,reaDispatchReady,Rea070Error}
  from "@/lib/nexus-rea-general-070";
import {PreflightError} from "@/lib/nexus-public-preflight";
import {diagnoseReaDemoOrigin} from "@/lib/nexus-rea-demo-origin";
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
  if(originDiagnostic!=="ORIGIN_OK")
    return NextResponse.json({
      error:"Origem não autorizada.",
      code:originDiagnostic,
      diagnostic_version:"NEXUS071_ORIGIN_DIAG_2"
    },{status:403,headers:{"Cache-Control":"private, no-store"}});
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
