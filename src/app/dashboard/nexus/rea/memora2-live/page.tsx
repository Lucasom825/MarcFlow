import {notFound} from "next/navigation";
import {auth} from "@/lib/auth";
import {bridgeConfig078} from "@/lib/nexus-memora2-bridge-078";
import {NexusMemora2Live078} from "@/components/nexus/memora2-live-078";

export const dynamic="force-dynamic";
export default async function Memora2LivePage(){
  if(process.env.NEXUS_DEMO_ONLY==="true")notFound();
  const config=bridgeConfig078();
  if(!config)notFound();
  const session=await auth();
  const email=session?.user?.email?.trim().toLowerCase()??"";
  if(email!==config.ownerEmail || email==="demo@nexus.invalid")notFound();
  return <NexusMemora2Live078/>;
}
