/**
 * NEXUS 084: protocol v2 only; cryptographically binds the Memora owner UUID
 * and the operator-reviewed grant ID to every signed GET.
 * Never sends the legacy v1 request. No cookies, secrets in browser or writes.
 */
import {Bridge078Error,type NexusMemoraBridgeConfig078}
  from "./nexus-memora2-bridge-078";
import {parseMemora2Recent076} from "./nexus-memora2-readiness-076";

const PATH="/api/integrations/nexus/readiness";
const CLIENT="nexus-memora2-v1";
const PURPOSE="memora-nexus-readiness-v2";
const CONTRACT="MEMORA2_NEXUS_READINESS_V1";
const LIMIT_BYTES=16_384;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GRANT=/^grant_[a-zA-Z0-9_-]{12,80}$/;
const encoder=new TextEncoder();

export type BoundGrant084=Readonly<{memoraOwnerId:string;grantId:string}>;
function validBinding(b:BoundGrant084):boolean{
  return UUID.test(b.memoraOwnerId) &&
    b.memoraOwnerId===b.memoraOwnerId.toLowerCase() &&
    GRANT.test(b.grantId);
}
function toHex(bytes:Uint8Array):string{
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
export function payloadNexus084(
  timestamp:string,nonce:string,binding:BoundGrant084
):string{
  if(!validBinding(binding))throw new Bridge078Error("INVALID_BINDING","Concessão inválida.");
  return [
    PURPOSE,"GET",PATH,timestamp,nonce,CLIENT,
    binding.memoraOwnerId,binding.grantId
  ].join("\n");
}
export async function signNexusMemora084(
  secret:string,timestamp:string,nonce:string,binding:BoundGrant084
):Promise<string>{
  const data=encoder.encode(payloadNexus084(timestamp,nonce,binding));
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC",key,data)));
}
function freshNonce():string{
  const nonce=new Uint8Array(16);
  crypto.getRandomValues(nonce);
  return toHex(nonce);
}
async function boundedJson(response:Response):Promise<unknown>{
  if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type")??""))
    throw new Bridge078Error("REMOTE_INVALID","Tipo de resposta inválido.");
  const declared=response.headers.get("content-length");
  if(declared!==null){
    const size=Number(declared);
    if(!Number.isSafeInteger(size)||size<0||size>LIMIT_BYTES)
      throw new Bridge078Error("REMOTE_SIZE","Resposta grande ou inválida.");
  }
  if(!response.body)throw new Bridge078Error("REMOTE_INVALID","Resposta vazia.");
  const reader=response.body.getReader();
  const chunks:Uint8Array[]=[];
  let total=0;
  try{
    while(true){
      const part=await reader.read();
      if(part.done)break;
      total+=part.value.byteLength;
      if(total>LIMIT_BYTES)throw new Bridge078Error("REMOTE_SIZE","Resposta muito grande.");
      chunks.push(part.value);
    }
  }finally{reader.releaseLock();}
  const combined=new Uint8Array(total);
  let offset=0;
  for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(combined));}
  catch{throw new Bridge078Error("REMOTE_INVALID","JSON inválido.");}
}
export async function readMemora2Bridge084(
  config:NexusMemoraBridgeConfig078,
  binding:BoundGrant084,
  fetcher:typeof fetch=fetch,
  now=Date.now()
){
  if(!validBinding(binding))
    throw new Bridge078Error("INVALID_BINDING","Concessão inválida.");
  const timestamp=String(Math.floor(now/1000));
  const nonce=freshNonce();
  const signature=await signNexusMemora084(
    config.secret,timestamp,nonce,binding
  );
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetcher(config.origin+PATH,{
      method:"GET",cache:"no-store",redirect:"error",credentials:"omit",
      signal:controller.signal,
      headers:{
        "Accept":"application/json",
        "x-memora-nexus-protocol":"2",
        "x-memora-nexus-timestamp":timestamp,
        "x-memora-nexus-nonce":nonce,
        "x-memora-nexus-client":CLIENT,
        "x-memora-nexus-owner":binding.memoraOwnerId,
        "x-memora-nexus-grant":binding.grantId,
        "x-memora-nexus-signature":signature
      }
    });
    if(!response.ok)
      throw new Bridge078Error("REMOTE_UNAVAILABLE","Consulta indisponível.");
    const parsed=await boundedJson(response);
    if(!parsed || typeof parsed!=="object"||Array.isArray(parsed))
      throw new Bridge078Error("REMOTE_INVALID","Contrato inválido.");
    const value=parsed as Record<string,unknown>;
    if(value.schema!==CONTRACT ||
       value.source!=="MEMORA2_SCOPED_READONLY" ||
       !Array.isArray(value.items)||value.items.length>8 ||
       value.items.some(item=>!item||typeof item!=="object"||
         !/^m2_[a-f0-9]{30}$/.test(String((item as Record<string,unknown>).id??""))))
      throw new Bridge078Error("REMOTE_INVALID","Contrato remoto inválido.");
    const report=parseMemora2Recent076(value.items,"ADAPTED_METADATA_ONLY");
    if(report.invalid_records!==0||report.items.length!==value.items.length)
      throw new Bridge078Error("REMOTE_INVALID","Metadados inválidos.");
    return report;
  }catch(error){
    if(error instanceof Bridge078Error)throw error;
    throw new Bridge078Error("REMOTE_UNAVAILABLE","Consulta indisponível.");
  }finally{clearTimeout(timeout);}
}
