import {NextResponse} from "next/server";
import {evaluateNexusIdentity083,readNexusOwnerGrant083} from "@/lib/nexus-memora2-identity-083";
import {readMemora2Bridge084} from "@/lib/nexus-memora2-bridge-084";
import {auth} from "@/lib/auth";
import {
  bridgeConfig078,Bridge078Error
} from "@/lib/nexus-memora2-bridge-078";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};

export async function GET(){
  // Demo data MUST remain synthetic; no real meeting data behind demo credentials.
  if(process.env.NEXUS_DEMO_ONLY==="true")
    return NextResponse.json({error:"Indisponível."},{status:404,headers:H});
  const config=bridgeConfig078();
  if(!config)return NextResponse.json({error:"Indisponível."},{status:404,headers:H});
  const session=await auth();
  const email=session?.user?.email?.trim().toLowerCase()??"";
  if(!email || email==="demo@nexus.invalid" || email!==config.ownerEmail)
    return NextResponse.json({error:"Não autorizado."},{status:403,headers:H});
  // A matching email alone is not a sufficient account-to-owner authorization.
  // Identity grant is OFF by default; an explicit, bounded, revocable mapping is mandatory.
  const decision=evaluateNexusIdentity083(process.env,{
    id:session?.user?.id,email,role:session?.user?.role
  },config.ownerEmail);
  if(!decision.allowed)
    return NextResponse.json({error:"Não autorizado."},{status:403,headers:H});
  // v2 only: bind the approved owner UUID and grant ID in the HMAC payload.
  const grant=readNexusOwnerGrant083(process.env);
  if(!grant)return NextResponse.json({error:"Não autorizado."},{status:403,headers:H});
  try{
    const result=await readMemora2Bridge084(config,{
      memoraOwnerId:grant.memoraOwnerId,
      grantId:grant.grantId
    });
    return NextResponse.json(result,{headers:H});
  }catch(error){
    if(error instanceof Bridge078Error)
      return NextResponse.json({error:"Consulta ao Memora 2 indisponível.",code:error.code},
        {status:502,headers:H});
    return NextResponse.json({error:"Falha na consulta."},{status:502,headers:H});
  }
}
export async function POST(){
  return NextResponse.json({error:"Método não permitido."},
    {status:405,headers:{...H,Allow:"GET"}});
}
