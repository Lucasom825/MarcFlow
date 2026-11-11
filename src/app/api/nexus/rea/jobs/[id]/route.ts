import {NextRequest,NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {getRea070RunState,Rea070Error,validateRunId}
  from "@/lib/nexus-rea-general-070";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(_request:NextRequest,ctx:{params:Promise<{id:string}>}){
  if(process.env.NEXUS_DEMO_ONLY!=="true")return NextResponse.json({error:"Indisponível."},{status:404});
  const session=await auth();
  if(session?.user?.email?.toLowerCase()!=="demo@nexus.invalid")
    return NextResponse.json({error:"Login de demonstração exigido."},{status:401});
  try{
    const {id}=await ctx.params;
    const state=await getRea070RunState(validateRunId(id));
    return NextResponse.json(state,{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    if(error instanceof Rea070Error)
      return NextResponse.json({error:error.message,code:error.code},{status:error.code==="INVALID_RUN"?400:error.code==="UNVERIFIED_RUN"?403:502});
    return NextResponse.json({error:"Não foi possível verificar o GitHub."},{status:502});
  }
}
