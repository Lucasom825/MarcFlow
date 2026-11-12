/**
 * NEXUS 076 — synthetically testable adapter for the Memora 2
 * GET /api/meetings/recent shape, inspected at main
 * 21f4f92bb2d827ce571d46abc27af8edad86965b.
 *
 * IMPORTANT: no network, connector, cookies, storage, identity, file access or writes.
 * The output drops originalName, error details and unrecognized remote fields.
 * A PDF-presence flag says nothing about minutes accuracy or human approval.
 */

export type MeetingStatus076 =
  | "UPLOADING" | "UPLOADED" | "TRANSCRIBING" | "ANALYZING"
  | "GENERATING_MINUTES" | "GENERATING_PDF" | "PROCESSED" | "ERROR";

export type MeetingReadiness076 =
  | "PDF_PRESENT_NOT_VALIDATED"
  | "PROCESSED_WITHOUT_PDF"
  | "ERROR_REVIEW"
  | "IN_PROGRESS";

export type Memora2Summary076=Readonly<{
  id:string;
  source:"recorded"|"imported";
  status:MeetingStatus076;
  createdAt:string;
  pdfVersion:number;
  hasSavedPdf:boolean;
}>;

export type Memora2ReadinessRow076=Readonly<{
  reference:string;
  source:Memora2Summary076["source"];
  status:MeetingStatus076;
  createdAt:string;
  pdfVersion:number;
  readiness:MeetingReadiness076;
  hasSavedPdf:boolean;
  audio_verified:false;
  transcript_verified:false;
  minutes_quality_verified:false;
}>;

export type Memora2ReadinessResult076=Readonly<{
  items:readonly Memora2ReadinessRow076[];
  invalid_records:number;
  source_scope:"SYNTHETIC"|"ADAPTED_METADATA_ONLY";
  full_inventory_verified:false;
  writes_performed:0;
}>;

const STATUS=new Set<MeetingStatus076>([
  "UPLOADING","UPLOADED","TRANSCRIBING","ANALYZING",
  "GENERATING_MINUTES","GENERATING_PDF","PROCESSED","ERROR",
]);

export function classifyMemora2Meeting076(v:Memora2Summary076):MeetingReadiness076{
  if(v.status==="ERROR")return "ERROR_REVIEW";
  if(v.status==="PROCESSED")return v.hasSavedPdf?
    "PDF_PRESENT_NOT_VALIDATED":"PROCESSED_WITHOUT_PDF";
  return "IN_PROGRESS";
}

export function parseMemora2Recent076(
  raw:unknown,
  source_scope:"SYNTHETIC"|"ADAPTED_METADATA_ONLY"="SYNTHETIC"
):Memora2ReadinessResult076{
  if(!Array.isArray(raw) || raw.length>8)
    throw new Error("Lista inválida: a consulta recente deve ter até 8 entradas.");
  const items:Memora2ReadinessRow076[]=[];
  let invalid_records=0;
  const seen=new Set<string>();
  for(const entry of raw){
    if(!entry || typeof entry!=="object" || Array.isArray(entry)){
      invalid_records++;continue;
    }
    const d=entry as Record<string,unknown>;
    if(typeof d.id!=="string" || d.id.length<1 || d.id.length>128 ||
      !/^[A-Za-z0-9_-]+$/.test(d.id) ||
      seen.has(d.id) ||
      (d.source!=="recorded" && d.source!=="imported") ||
      typeof d.status!=="string" || !STATUS.has(d.status as MeetingStatus076) ||
      typeof d.createdAt!=="string" || d.createdAt.length>40 ||
      !Number.isFinite(Date.parse(d.createdAt)) ||
      typeof d.hasSavedPdf!=="boolean" ||
      !Number.isSafeInteger(d.pdfVersion) || Number(d.pdfVersion)<1 || Number(d.pdfVersion)>100000){
      invalid_records++;continue;
    }
    seen.add(d.id);
    const safe:Memora2Summary076={
      id:d.id,source:d.source as Memora2Summary076["source"],
      status:d.status as MeetingStatus076,createdAt:d.createdAt,
      hasSavedPdf:d.hasSavedPdf,pdfVersion:d.pdfVersion as number,
    };
    items.push({
      reference:safe.id,
      source:safe.source,
      status:safe.status,
      createdAt:safe.createdAt,
      pdfVersion:safe.pdfVersion,
      hasSavedPdf:safe.hasSavedPdf,
      readiness:classifyMemora2Meeting076(safe),
      audio_verified:false,
      transcript_verified:false,
      minutes_quality_verified:false,
    });
  }
  return {
    items,invalid_records,source_scope,
    full_inventory_verified:false,writes_performed:0,
  };
}

export const syntheticMemora2Recent076:ReadonlyArray<Record<string,unknown>>=[
  {
    id:"demo-meeting-001",source:"recorded",status:"PROCESSED",
    createdAt:"2026-11-10T09:00:00.000Z",pdfVersion:1,hasSavedPdf:true,
    originalName:"Nome privado que deve ser descartado",error:null,
  },
  {
    id:"demo-meeting-002",source:"imported",status:"ANALYZING",
    createdAt:"2026-11-10T11:00:00.000Z",pdfVersion:1,hasSavedPdf:false,
  },
  {
    id:"demo-meeting-003",source:"recorded",status:"ERROR",
    createdAt:"2026-11-10T13:00:00.000Z",pdfVersion:1,hasSavedPdf:false,
    error:"Diagnóstico interno: não pode sair na UI.",
  },
  {
    id:"demo-meeting-004",source:"imported",status:"PROCESSED",
    createdAt:"2026-11-10T14:00:00.000Z",pdfVersion:1,hasSavedPdf:false,
  },
];

export function summarizeMemora2Readiness076(r:Memora2ReadinessResult076){
  const counts={
    pdf_present:r.items.filter(x=>x.readiness==="PDF_PRESENT_NOT_VALIDATED").length,
    processed_without_pdf:r.items.filter(x=>x.readiness==="PROCESSED_WITHOUT_PDF").length,
    in_progress:r.items.filter(x=>x.readiness==="IN_PROGRESS").length,
    review:r.items.filter(x=>x.readiness==="ERROR_REVIEW").length,
    invalid:r.invalid_records,
  };
  return counts;
}
