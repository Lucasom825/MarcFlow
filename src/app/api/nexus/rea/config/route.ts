import {NextRequest,NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {reaDispatchReady,checkReaCredential} from "@/lib/nexus-rea-general-070";
import {canonicalReaDemoPage} from "@/lib/nexus-rea-demo-origin";
import {makeReaCsrfProof} from "@/lib/nexus-rea-csrf-071";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
  if(process.env.NEXUS_DEMO_ONLY!=="true")return NextResponse.json({error:"Indisponível."},{status:404});
  const s=await auth();
  if(s?.user?.email?.toLowerCase()!=="demo@nexus.invalid")
    return NextResponse.json({error:"Acesso à demonstração exigido."},{status:401});
  const credential_check=request.nextUrl.searchParams.get("diagnose")==="1"
    ? await checkReaCredential() : undefined;
  return NextResponse.json({configured:reaDispatchReady(),mode:"PUBLIC_STATIC_ONLY",
    ...(credential_check ? {credential_check} : {}),
    canonical_demo_url:canonicalReaDemoPage(process.env.NEXUS_REA_ALLOWED_ORIGIN),
    dispatch_proof:makeReaCsrfProof(String(s.user?.id??""),process.env.NEXUS_REA_ALLOWED_ORIGIN,process.env.AUTH_SECRET)},
    {headers:{"Cache-Control":"private, no-store"}});
}
