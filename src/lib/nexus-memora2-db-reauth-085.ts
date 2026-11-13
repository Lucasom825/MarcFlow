/**
 * NEXUS 085: read-only, request-time DB verification for Memora 2 status read.
 *
 * The JWT's id/email/role are untrusted for continuing authorization.
 * Re-read the current DB account on EVERY real metadata request.
 * No "isActive" exists in the current Prisma User model, so a soft-disabled
 * account cannot yet be proven inactive. Deny missing / changed users.
 */
import type {Identity083} from "./nexus-memora2-identity-083";

export type CurrentAccount085=Readonly<{
  id:string;email:string;role:string;
}>;
type UserProjection085={id:string;email:string;role:string};
export type ReadOnlyUserStore085=Readonly<{
  user:{
    findUnique(args:{
      where:{id:string};
      select:{id:true;email:true;role:true};
    }):Promise<UserProjection085|null>;
  };
}>;
export type DbDecision085=Readonly<{
  allowed:boolean;
  reason:"AUTHORIZED"|"MISSING_SESSION"|"ACCOUNT_NOT_FOUND"|"ACCOUNT_CHANGED"|
    "ROLE_REVOKED"|"DATABASE_UNAVAILABLE";
}>;
const allowedRole=(role:string)=>role==="OWNER"||role==="SUPERADMIN";
const normalizeEmail=(value:string)=>value.trim().toLowerCase();
const DENIED=(reason:Exclude<DbDecision085["reason"],"AUTHORIZED">):DbDecision085=>
  ({allowed:false,reason});
/**
 * Runs only after the 083 grant gate, for the exact session ID selected there.
 * The DB query selects only the minimum nonsecret fields. Never select a
 * password, API key, sessions, messages, or business data.
 */
export async function revalidateNexusUser085(
  database:ReadOnlyUserStore085,
  session:Identity083|null
):Promise<DbDecision085>{
  const id=session?.id??"";
  const email=session?.email??"";
  const role=session?.role??"";
  if(!id||!email||!role)return DENIED("MISSING_SESSION");
  let account:UserProjection085|null;
  try{
    account=await database.user.findUnique({
      where:{id},
      select:{id:true,email:true,role:true}
    });
  }catch{
    return DENIED("DATABASE_UNAVAILABLE");
  }
  if(!account)return DENIED("ACCOUNT_NOT_FOUND");
  // Check the complete current account against JWT claims; the JWT alone
  // is insufficient if email or role was changed since login.
  if(account.id!==id||normalizeEmail(account.email)!==normalizeEmail(email))
    return DENIED("ACCOUNT_CHANGED");
  if(!allowedRole(account.role) || account.role!==role)
    return DENIED("ROLE_REVOKED");
  return {allowed:true,reason:"AUTHORIZED"};
}
