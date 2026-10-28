import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScanLine } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Pill } from "@/components/ui";

export type Reading = {engine:string; detected_type:string; expected_type:string; quality_score:number|null; fields:{key:string;label:string;value:string;source:string}[];warnings:string[];review_required:boolean;notice:string};
const KIND:Record<string,string> = {cin:"CIN / passeport",attestation_amo:"Attestation AMO",mutuelle:"Mutuelle / assurance",consentement_admin:"Consentement",unknown:"À identifier manuellement"};
export function ReadingReport({report,reviewed=false}:{report:Reading;reviewed?:boolean}) {
  return <div className="space-y-3 rounded-card border border-teal-500/30 bg-mint-100/50 p-4" aria-label="Résultat de lecture">
    <div className="flex flex-wrap items-center gap-2"><ScanLine size={17} className="text-teal-700"/><strong className="text-navy-900">Lecture assistée locale</strong><Pill tone={reviewed?"success":"warning"}>{reviewed?"Vérifié par l’équipe":"À vérifier"}</Pill></div>
    <p>Type suggéré : <strong>{KIND[report.detected_type]??report.detected_type}</strong></p>
    {report.quality_score!==null && <p className="text-meta text-ink-2">Indice technique OCR : {report.quality_score}/100 — ce n'est pas une probabilité de validité.</p>}
    {report.fields.length>0 && <dl className="divide-y divide-line rounded-ctl bg-white px-3">{report.fields.map(f=><div key={f.key} className="py-2"><dt className="text-meta text-ink-2">{f.label}</dt><dd className="font-semibold" dir="auto">{f.value}</dd><p className="text-meta text-ink-2">Source : {f.source}</p></div>)}</dl>}
    {report.warnings.map(w=><p key={w} className="rounded-ctl bg-warning-bg p-2 text-warning-text">{w}</p>)}
    <p className="text-meta text-ink-2">{report.notice}</p>
  </div>;
}
export default function DocumentReading({id,reviewed=false}:{id:string;reviewed?:boolean}) {
  const [open,setOpen]=useState(false); const qc=useQueryClient();
  const q=useQuery({queryKey:["reading",id],queryFn:()=>api<{report:Reading|null}>(`/documents/${id}/analysis`),enabled:open});
  const analyze=useMutation({mutationFn:()=>api<Reading>(`/documents/${id}/analyze`,{method:"POST"}),onSuccess:r=>qc.setQueryData(["reading",id],{report:r})});
  return <div className="w-full"><Button size="sm" variant="ghost" onClick={()=>setOpen(!open)}><ScanLine size={14}/>{open?"Fermer la lecture":"Lire et contrôler la pièce"}</Button>
    {open && <div className="mt-2 space-y-2">{q.data?.report && <ReadingReport report={q.data.report} reviewed={reviewed}/>}
      <Button size="sm" variant="secondary" disabled={analyze.isPending} onClick={()=>analyze.mutate()}>{analyze.isPending?"Lecture en cours…":q.data?.report?"Relire la pièce":"Lancer la lecture locale"}</Button>
      {analyze.isError && <p role="alert" className="text-critical-text">Lecture impossible. Vérifiez la pièce manuellement.</p>}</div>}
  </div>;
}
