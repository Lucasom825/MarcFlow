/**
 * NEXUS 083: restrictive, experimental identity/permission gate for Memora 2.
 * No connector, external service, storage, secret or remote identity lookup.
 * Does not prove that two accounts belong to the same natural person.
 */
export type Identity083 = Readonly<{
  id?:string|null;
  email?:string|null;
  role?:string|null;
}>;
export type NexusOwnerGrant083 = Readonly<{
  nexusUserId:string;
  nexusEmail:string;
  memoraOwnerId:string;
  grantId:string;
  expiresAt:number;
}>;
export type AccessDecision083 = Readonly<{
  allowed:boolean;
  reason:"AUTHORIZED"|"DISABLED"|"REVOKED"|"INVALID_GRANT"|"EXPIRED"|
    "SUBJECT_MISMATCH"|"ROLE_DENIED"|"EMAIL_MISMATCH";
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[a-zA-Z0-9_-]{8,128}$/;
const GRANT_ID=/^grant_[a-zA-Z0-9_-]{12,80}$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_GRANT_LIFETIME_MS=30*24*60*60*1000;

export function readNexusOwnerGrant083(
  env:Readonly<Record<string,string|undefined>>,
  now=Date.now()
):NexusOwnerGrant083|null{
  const userId=env.NEXUS_MEMORA2_APPROVED_NEXUS_USER_ID?.trim()??"";
  const ownerId=env.NEXUS_MEMORA2_APPROVED_MEMORA_OWNER_ID?.trim()??"";
  const email=env.NEXUS_MEMORA2_APPROVED_NEXUS_EMAIL?.trim().toLowerCase()??"";
  const grantId=env.NEXUS_MEMORA2_ACCESS_GRANT_ID?.trim()??"";
  const expiry=env.NEXUS_MEMORA2_GRANT_EXPIRES_UTC??"";
  if(env.NEXUS_MEMORA2_IDENTITY_APPROVED!=="true" ||
    env.NEXUS_MEMORA2_IDENTITY_REVOKED!=="false" ||
    !ID.test(userId) || !UUID.test(ownerId) || !EMAIL.test(email) ||
    email==="demo@nexus.invalid" || !GRANT_ID.test(grantId) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(expiry))
    return null;
  const expiresAt=Date.parse(expiry);
  if(!Number.isFinite(expiresAt) || new Date(expiresAt).toISOString()!==expiry ||
    expiresAt>now+MAX_GRANT_LIFETIME_MS)return null;
  return {nexusUserId:userId,nexusEmail:email,memoraOwnerId:ownerId,
    grantId,expiresAt};
}
export function evaluateNexusIdentity083(
  env:Readonly<Record<string,string|undefined>>,
  principal:Identity083|null,
  bridgeOwnerEmail:string|null,
  now=Date.now()
):AccessDecision083{
  if(env.NEXUS_MEMORA2_IDENTITY_APPROVED!=="true")
    return {allowed:false,reason:"DISABLED"};
  if(env.NEXUS_MEMORA2_IDENTITY_REVOKED!=="false")
    return {allowed:false,reason:"REVOKED"};
  const g=readNexusOwnerGrant083(env,now);
  if(!g)return {allowed:false,reason:"INVALID_GRANT"};
  if(now>=g.expiresAt)return {allowed:false,reason:"EXPIRED"};
  if(!principal || principal.id!==g.nexusUserId)
    return {allowed:false,reason:"SUBJECT_MISMATCH"};
  if(principal.role!=="OWNER"&&principal.role!=="SUPERADMIN")
    return {allowed:false,reason:"ROLE_DENIED"};
  const email=principal.email?.trim().toLowerCase()??"";
  if(email!==g.nexusEmail || bridgeOwnerEmail?.trim().toLowerCase()!==g.nexusEmail)
    return {allowed:false,reason:"EMAIL_MISMATCH"};
  return {allowed:true,reason:"AUTHORIZED"};
}
/** Public payload intentionally excludes UUID, email and user ID. */
export function redactedIdentityDecision083(decision:AccessDecision083){
  return {allowed:decision.allowed,status:decision.allowed?"ALLOWED":"DENIED"} as const;
}
