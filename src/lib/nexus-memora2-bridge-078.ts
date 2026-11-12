/**
 * NEXUS 078 - server-only signed connection to Memora 2 status summaries.
 * OFF by default, impossible to use from demo sessions. Never read/share
 * browser cookies, secrets or user-supplied URL. No writes or scheduling.
 */
import {parseMemora2Recent076} from "./nexus-memora2-readiness-076";

const BRIDGE_PATH="/api/integrations/nexus/readiness";
const BRIDGE_CLIENT="nexus-memora2-v1";
const SCHEMA="MEMORA2_NEXUS_READINESS_V1";
const MAX_BYTES=16_384;
const encoder=new TextEncoder();

export type NexusMemoraBridgeConfig078={
  origin:string;secret:string;ownerEmail:string;
};
export class Bridge078Error extends Error{
  constructor(public code:string,message:string){super(message);}
}
export function bridgeConfig078(env:NodeJS.ProcessEnv=process.env):NexusMemoraBridgeConfig078|null{
  const secret=env.NEXUS_MEMORA2_BRIDGE_SECRET?.trim()??"";
  const raw=env.NEXUS_MEMORA2_ORIGIN?.trim()??"";
  const host=env.NEXUS_MEMORA2_ALLOWED_HOST?.trim().toLowerCase()??"";
  const ownerEmail=env.NEXUS_MEMORA2_OWNER_EMAIL?.trim().toLowerCase()??"";
  if(env.NEXUS_MEMORA2_BRIDGE_ENABLED!=="true" ||
    !/^[A-Za-z0-9_-]{43,160}$/.test(secret) ||
    !/^[a-z0-9.-]{4,200}$/.test(host) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail))return null;
  try{
    const url=new URL(raw);
    if(url.protocol!=="https:" || url.hostname.toLowerCase()!==host ||
      url.port || url.username || url.password ||
      url.pathname!=="/" || url.search || url.hash)return null;
    return {origin:url.origin,secret,ownerEmail};
  }catch{return null;}
}
function hex(bytes:Uint8Array){
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
function nonce078():string{
  const data=new Uint8Array(16);crypto.getRandomValues(data);return hex(data);
}
export async function signNexusMemora078(
  secret:string,timestamp:string,nonce:string
):Promise<string>{
  const payload=[
    "memora-nexus-readiness-v1","GET",BRIDGE_PATH,timestamp,nonce,BRIDGE_CLIENT
  ].join("\n");
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(payload))));
}
async function boundedBody(response:Response):Promise<unknown>{
  const length=Number(response.headers.get("content-length"));
  if(Number.isFinite(length)&&length>MAX_BYTES)
    throw new Bridge078Error("REMOTE_SIZE","Resposta muito grande.");
  if(!response.body)throw new Bridge078Error("REMOTE_INVALID","Resposta vazia.");
  const reader=response.body.getReader();
  const chunks:Uint8Array[]=[];
  let size=0;
  try{
    while(true){
      const result=await reader.read();
      if(result.done)break;
      const chunk=result.value;
      size+=chunk.byteLength;
      if(size>MAX_BYTES)throw new Bridge078Error("REMOTE_SIZE","Resposta muito grande.");
      chunks.push(chunk);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;
  for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
  try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}
  catch{throw new Bridge078Error("REMOTE_INVALID","Resposta inválida.");}
}
export async function readMemora2Bridge078(
  config:NexusMemoraBridgeConfig078,
  fetcher:typeof fetch=fetch,
  now:number=Date.now()
){
  const timestamp=String(Math.floor(now/1000));
  const nonce=nonce078();
  const signature=await signNexusMemora078(config.secret,timestamp,nonce);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetcher(config.origin+BRIDGE_PATH,{
      method:"GET",
      redirect:"error",
      cache:"no-store",
      credentials:"omit",
      signal:controller.signal,
      headers:{
        "Accept":"application/json",
        "x-memora-nexus-timestamp":timestamp,
        "x-memora-nexus-nonce":nonce,
        "x-memora-nexus-client":BRIDGE_CLIENT,
        "x-memora-nexus-signature":signature
      }
    });
    if(!response.ok)throw new Bridge078Error("REMOTE_UNAVAILABLE",
      "Memora 2 não disponibilizou metadados.");
    const contentType=response.headers.get("content-type")??"";
    if(!/^application\/json(?:\s*;|$)/i.test(contentType))
      throw new Bridge078Error("REMOTE_INVALID","Tipo de resposta inesperado.");
    const document=await boundedBody(response);
    if(!document || typeof document!=="object" || Array.isArray(document))
      throw new Bridge078Error("REMOTE_INVALID","Resposta inválida.");
    const value=document as Record<string,unknown>;
    if(value.schema!==SCHEMA || value.source!=="MEMORA2_SCOPED_READONLY" ||
      !Array.isArray(value.items) || value.items.length>8 ||
      value.items.some(entry=>!entry || typeof entry!=="object" ||
        !/^m2_[0-9a-f]{30}$/.test(String((entry as Record<string,unknown>).id??"")))){
      throw new Bridge078Error("REMOTE_INVALID","Contrato remoto não corresponde.");
    }
    const parsed=parseMemora2Recent076(value.items,"ADAPTED_METADATA_ONLY");
    if(parsed.invalid_records>0 || parsed.items.length!==value.items.length)
      throw new Bridge078Error("REMOTE_INVALID","Metadados remotos inválidos.");
    return parsed;
  }catch(e){
    if(e instanceof Bridge078Error)throw e;
    throw new Bridge078Error("REMOTE_UNAVAILABLE","Memora 2 indisponível para leitura.");
  }finally{clearTimeout(timeout);}
}
