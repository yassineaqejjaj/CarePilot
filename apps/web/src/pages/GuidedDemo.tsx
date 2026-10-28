import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Camera, Check, Play, ArrowRight, Smartphone, LayoutDashboard } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import type { JourneyDetail } from "@/lib/types";
import { Button, Card, Pill, Progress } from "@/components/ui";
import { ReadingReport, type Reading } from "@/components/DocumentReading";
import { LiveBadge } from "@/lib/live";

type Scenario={id:string;journey_id:string;reference:string};
export default function GuidedDemo(){
  const [scenario,setScenario]=useState<Scenario|null>(null);const [sample,setSample]=useState<{document_id:string;task_id:string;report:Reading}|null>(null);
  const key=useRef(crypto.randomUUID());const qc=useQueryClient();
  const create=useMutation({mutationFn:()=>api<Scenario>("/demo/scenarios",{method:"POST",body:JSON.stringify({request_id:key.current})}),onSuccess:setScenario});
  const detail=useQuery({queryKey:["demo-detail",scenario?.journey_id],queryFn:()=>api<JourneyDetail>(`/journeys/${scenario?.journey_id}/detail`),enabled:!!scenario,refetchInterval:3000});
  const upload=useMutation({mutationFn:()=>api<NonNullable<typeof sample>>(`/demo/scenarios/${scenario?.id}/sample`,{method:"POST"}),onSuccess:r=>{setSample(r);qc.invalidateQueries({queryKey:["demo-detail"]});}});
  const validate=useMutation({mutationFn:()=>api(`/tasks/${sample?.task_id}/complete`,{method:"POST"}),onSuccess:()=>["demo-detail","cockpit","journeys"].forEach(k=>qc.invalidateQueries({queryKey:[k]}))});
  const pct=detail.data?.progress.pct??0;const done=sample&&detail.data?.documents.find(d=>d.id===sample.task_id)?.status==="Validé";
  const stage=!scenario?0:!sample?1:!done?2:3;
  const error=create.error||upload.error||validate.error;
  return <div className="space-y-5"><div><Pill tone="mint">Démonstration guidée · données fictives</Pill><h1 className="mt-2 text-[28px] font-semibold tracking-tight">Du téléphone au dossier complet.</h1><p className="mt-1 text-ink-2">Un scénario de 90 secondes, avec une pièce fictive réellement déposée, lue puis validée. Vos dossiers existants restent en place.</p></div>
    <div className="flex flex-wrap gap-2">{["Créer le scénario","Déposer la pièce","Vérifier la lecture","Valider le dossier"].map((s,i)=><span key={s} className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm ${i<=stage?"bg-mint-100 text-teal-800":"bg-surface-2 text-ink-2"}`}><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs">{i<stage?<Check size={12}/>:i+1}</span>{s}</span>)}</div>
    {!scenario?<Card className="p-6"><h2 className="text-lg font-semibold">Rencontrez Amal, votre patiente fictive.</h2><p className="mt-2 max-w-2xl text-ink-2">Son dossier est presque complet. Il manque une prise en charge mutuelle. Le scénario crée un nouveau dossier isolé, sans effacer ni réinitialiser les autres données.</p><Button className="mt-4" disabled={create.isPending} onClick={()=>create.mutate()}><Play size={16}/>{create.isPending?"Création…":"Lancer la démonstration"}</Button></Card>:<div className="grid items-start gap-6 xl:grid-cols-[370px_1fr]">
      <div className="rounded-[32px] border-[8px] border-navy-900 bg-page shadow-modal"><div className="flex items-center gap-2 border-b border-line bg-white px-4 py-3"><Smartphone size={17}/><strong>Amal · espace patient</strong></div><div className="space-y-4 p-4"><h2 className="text-xl font-semibold">Bonjour Amal 👋</h2><div className="rounded-panel bg-navy-900 p-4 text-white"><p className="text-meta text-signal">PROCHAINE ÉTAPE</p><h3 className="mt-2 font-semibold text-white">Votre prise en charge mutuelle</h3><p className="mt-2 text-sm text-white/80">Photographiez votre document pour finaliser votre dossier.</p><Button className="mt-4 w-full bg-signal text-navy-900" disabled={!!sample||upload.isPending} onClick={()=>upload.mutate()}><Camera size={16}/>{upload.isPending?"Dépôt et lecture…":sample?"Pièce déposée":"Déposer la pièce fictive"}</Button></div><Card className="p-4"><div className="flex items-center justify-between"><strong>Préparation</strong><span>{pct} %</span></div><Progress value={pct} className="mt-3"/><p className="mt-2 text-sm text-ink-2">{done?"Votre pièce est validée !":"Votre équipe vérifie les pièces reçues."}</p></Card><p className="text-meta text-ink-2">Aperçu guidé d'un patient fictif. Aucune donnée réelle ni envoi externe.</p></div></div>
      <Card className="space-y-4 p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold"><LayoutDashboard size={18}/>Côté coordinatrice</h2><LiveBadge/></div><p className="text-ink-2">Dossier {scenario.reference} · Amal Démo guidée</p>
        {!sample?<p className="rounded-card bg-page p-5">En attente du dépôt sur le téléphone à gauche…</p>:<><ReadingReport report={sample.report} reviewed={!!done}/><div className="flex items-center gap-3"><Pill tone={done?"success":"info"}>{done?"Validé":"En revue"}</Pill><Button disabled={!!done||validate.isPending} onClick={()=>validate.mutate()}><Check size={15}/>{done?"Pièce validée":"J'ai vérifié : valider la pièce"}</Button></div></>}
        {done&&<div className="rounded-card bg-success-bg p-4 text-success-text"><p className="font-semibold">Dossier administratif complet : {pct} %</p><p className="mt-1">La validation humaine a actualisé le dossier. Le cockpit et le portail se synchronisent automatiquement.</p></div>}
        <div className="flex flex-wrap gap-3"><Link className="font-semibold text-teal-700 hover:underline" to={`/parcours/${scenario.journey_id}`}>Voir le vrai dossier créé →</Link><Link className="font-semibold text-teal-700 hover:underline" to="/copilote">Essayer le copilote →</Link></div>
      </Card>
    </div>}
    {error&&<p role="alert" className="rounded-card bg-critical-bg p-3 text-critical-text">{error instanceof ApiError?error.detail:"Scénario indisponible. Vérifiez que le mode démonstration est activé."}</p>}
  </div>;
}
