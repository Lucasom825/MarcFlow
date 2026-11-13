/**
 * NEXUS 086 - disposable SQLite proof of persistent authorization.
 * NOT imported by Next.js; NOT a Prisma migration; NOT production.
 * Restricted to nexus086-synthetic-* directories under OS temp root.
 */
import {DatabaseSync} from "node:sqlite";
import {resolve,sep,basename,dirname} from "node:path";
import {tmpdir} from "node:os";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBJECT=/^[A-Za-z0-9_-]{8,128}$/;
const GRANT=/^grant_[A-Za-z0-9_-]{12,80}$/;
const ACTOR=/^[A-Za-z0-9_-]{8,128}$/;
const MAX_MS=30*24*60*60*1000;
const verdict=(reason)=>({allowed:reason==="ALLOWED",reason});
const validTime=(n)=>Number.isSafeInteger(n)&&n>=0;
function checkId(pattern,value,name){
  if(typeof value!=="string"||!pattern.test(value))
    throw new Error("Invalid synthetic "+name);
}
function checkTime(value){if(!validTime(value))throw new Error("Invalid synthetic clock");}
function checkFile(file,approval){
  const path=resolve(file??"");
  const parent=dirname(path);
  if(approval!=="APPROVED_LOCAL_SYNTHETIC" ||
      !parent.startsWith(resolve(tmpdir())+sep) ||
      !parent.split(sep).some(x=>x.startsWith("nexus086-synthetic-")) ||
      basename(path)!=="access-086.sqlite")
    throw new Error("NEXUS 086 refuses non-synthetic or application database paths");
  return path;
}
export function openSyntheticAccess086({file,approval}){
  const db=new DatabaseSync(checkFile(file,approval));
  db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
  db.exec([
    "CREATE TABLE IF NOT EXISTS nx086_subject (",
    " subject_id TEXT PRIMARY KEY,",
    " status TEXT NOT NULL CHECK(status IN ('ACTIVE','SUSPENDED')),",
    " updated_ms INTEGER NOT NULL);",
    "CREATE TABLE IF NOT EXISTS nx086_grant (",
    " grant_id TEXT PRIMARY KEY,",
    " subject_id TEXT NOT NULL REFERENCES nx086_subject(subject_id) ON DELETE RESTRICT,",
    " owner_uuid TEXT NOT NULL,",
    " issued_ms INTEGER NOT NULL,",
    " expires_ms INTEGER NOT NULL CHECK(expires_ms>issued_ms),",
    " revoked_ms INTEGER, actor_id TEXT NOT NULL);",
    "CREATE UNIQUE INDEX IF NOT EXISTS nx086_unrevoked_owner",
    " ON nx086_grant(subject_id,owner_uuid) WHERE revoked_ms IS NULL;",
    "CREATE INDEX IF NOT EXISTS nx086_grant_subject",
    " ON nx086_grant(subject_id,owner_uuid);",
    "CREATE TABLE IF NOT EXISTS nx086_audit (",
    " sequence INTEGER PRIMARY KEY AUTOINCREMENT,",
    " occurred_ms INTEGER NOT NULL,actor_id TEXT NOT NULL,",
    " subject_id TEXT NOT NULL,grant_id TEXT,",
    " action TEXT NOT NULL CHECK(action IN (",
    " 'REGISTERED_SUSPENDED','ACTIVATED','SUSPENDED',",
    " 'GRANTED','REVOKED','REVOKED_ON_SUSPENSION')));"
  ].join("\n"));
  let closed=false;
  function atomic(work){
    if(closed)throw new Error("Synthetic store closed");
    db.exec("BEGIN IMMEDIATE");
    try{
      const result=work();db.exec("COMMIT");return result;
    }catch(error){
      db.exec("ROLLBACK");throw error;
    }
  }
  function audit({now,actor,subject,grant=null,action}){
    db.prepare("INSERT INTO nx086_audit (occurred_ms,actor_id,subject_id,grant_id,action) VALUES (?,?,?,?,?)")
      .run(now,actor,subject,grant,action);
  }
  function registerSubject({subject,actor,now}){
    checkId(SUBJECT,subject,"subject");checkId(ACTOR,actor,"actor");checkTime(now);
    return atomic(()=>{
      const write=db.prepare("INSERT INTO nx086_subject (subject_id,status,updated_ms) VALUES (?,?,?)")
        .run(subject,"SUSPENDED",now);
      audit({now,actor,subject,action:"REGISTERED_SUSPENDED"});
      return write.changes===1;
    });
  }
  function setStatus({subject,status,actor,now}){
    checkId(SUBJECT,subject,"subject");checkId(ACTOR,actor,"actor");checkTime(now);
    if(status!=="ACTIVE"&&status!=="SUSPENDED")throw new Error("Invalid status");
    return atomic(()=>{
      const old=db.prepare("SELECT status FROM nx086_subject WHERE subject_id=?").get(subject);
      if(!old)throw new Error("Subject not registered");
      if(old.status===status)return false;
      db.prepare("UPDATE nx086_subject SET status=?,updated_ms=? WHERE subject_id=?")
        .run(status,now,subject);
      audit({now,actor,subject,action:status==="ACTIVE"?"ACTIVATED":"SUSPENDED"});
      if(status==="SUSPENDED"){
        const unrevoked=db.prepare("SELECT grant_id FROM nx086_grant WHERE subject_id=? AND revoked_ms IS NULL").all(subject);
        db.prepare("UPDATE nx086_grant SET revoked_ms=? WHERE subject_id=? AND revoked_ms IS NULL")
          .run(now,subject);
        for(const g of unrevoked)
          audit({now,actor,subject,grant:g.grant_id,action:"REVOKED_ON_SUSPENSION"});
      }
      return true;
    });
  }
  function issueGrant({subject,owner,grant,actor,now,expires}){
    checkId(SUBJECT,subject,"subject");checkId(UUID,owner,"owner");
    checkId(GRANT,grant,"grant");checkId(ACTOR,actor,"actor");
    checkTime(now);checkTime(expires);
    if(owner!==owner.toLowerCase()||expires<=now||expires>now+MAX_MS)
      throw new Error("Grant TTL or owner format invalid");
    return atomic(()=>{
      const user=db.prepare("SELECT status FROM nx086_subject WHERE subject_id=?").get(subject);
      if(!user||user.status!=="ACTIVE")
        throw new Error("Cannot grant an unknown or suspended subject");
      const write=db.prepare("INSERT INTO nx086_grant (grant_id,subject_id,owner_uuid,issued_ms,expires_ms,revoked_ms,actor_id) VALUES (?,?,?,?,?,NULL,?)")
        .run(grant,subject,owner,now,expires,actor);
      audit({now,actor,subject,grant,action:"GRANTED"});
      return write.changes===1;
    });
  }
  function revokeGrant({grant,actor,now}){
    checkId(GRANT,grant,"grant");checkId(ACTOR,actor,"actor");checkTime(now);
    return atomic(()=>{
      const row=db.prepare("SELECT subject_id FROM nx086_grant WHERE grant_id=? AND revoked_ms IS NULL").get(grant);
      if(!row)return false;
      db.prepare("UPDATE nx086_grant SET revoked_ms=? WHERE grant_id=? AND revoked_ms IS NULL")
        .run(now,grant);
      audit({now,actor,subject:row.subject_id,grant,action:"REVOKED"});
      return true;
    });
  }
  function authorize({subject,owner,grant,now}){
    if(!validTime(now)||typeof subject!=="string"||!SUBJECT.test(subject)||
       typeof owner!=="string"||!UUID.test(owner)||owner!==owner.toLowerCase()||
       typeof grant!=="string"||!GRANT.test(grant))
      return verdict("INVALID_INPUT");
    if(closed)return verdict("STORE_UNAVAILABLE");
    try{
      const row=db.prepare("SELECT s.status,g.subject_id AS grant_subject,g.owner_uuid,g.expires_ms,g.revoked_ms FROM nx086_subject AS s LEFT JOIN nx086_grant AS g ON g.grant_id=? WHERE s.subject_id=?")
        .get(grant,subject);
      if(!row)return verdict("SUBJECT_UNKNOWN");
      if(row.status!=="ACTIVE")return verdict("SUBJECT_SUSPENDED");
      if(row.grant_subject===null)return verdict("GRANT_UNKNOWN");
      if(row.grant_subject!==subject||row.owner_uuid!==owner)
        return verdict("GRANT_MISMATCH");
      if(row.revoked_ms!==null)return verdict("GRANT_REVOKED");
      if(now>=row.expires_ms)return verdict("GRANT_EXPIRED");
      return verdict("ALLOWED");
    }catch{return verdict("STORE_UNAVAILABLE");}
  }
  function auditSnapshot(){
    if(closed)throw new Error("Synthetic store closed");
    return db.prepare("SELECT sequence,occurred_ms,actor_id,subject_id,grant_id,action FROM nx086_audit ORDER BY sequence").all();
  }
  function close(){if(!closed){db.close();closed=true;}}
  return {registerSubject,setStatus,issueGrant,revokeGrant,authorize,auditSnapshot,close};
}
