import {NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {reaDispatchReady} from "@/lib/nexus-rea-general-070";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(){
  if(process.env.NEXUS_DEMO_ONLY!=="true")return NextResponse.json({error:"Indisponível."},{status:404});
  const s=await auth();
  if(s?.user?.email?.toLowerCase()!=="demo@nexus.invalid")
    return NextResponse.json({error:"Acesso à demonstração exigido."},{status:401});
  return NextResponse.json({configured:reaDispatchReady(),mode:"PUBLIC_STATIC_ONLY"},
    {headers:{"Cache-Control":"private, no-store"}});
}
