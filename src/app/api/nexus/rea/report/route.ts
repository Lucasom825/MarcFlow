import {NextRequest,NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {fetchPublicReaGitHub,loadVerifiedPublicReaReport,ReaPublicReportError}
  from "@/lib/nexus-rea-public-report";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:NextRequest){
  if(process.env.NEXUS_DEMO_ONLY!=="true")
    return NextResponse.json({error:"Recurso indisponível fora da demonstração."},{status:404});
  const session=await auth();
  if(!session?.user)
    return NextResponse.json({error:"É necessário entrar no NEXUS."},{status:401});
  try{
    const report=await loadVerifiedPublicReaReport(fetchPublicReaGitHub);
    return NextResponse.json(report,{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    const known=error instanceof ReaPublicReportError;
    const status=known && error.code==="RATE_LIMIT"?429:known && error.code==="NOT_PUBLISHED"?404:502;
    return NextResponse.json({
      error:known?error.message:"Não foi possível validar o relatório público.",
      code:known?error.code:"FETCH_FAILED",
    },{status,headers:{"Cache-Control":"no-store"}});
  }
}
