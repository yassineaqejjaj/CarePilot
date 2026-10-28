import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { Button, Card, Confirm, Pill, useToast } from "@/components/ui";

type Plan={supported:boolean;message?:string;id:string;start:string;end:string;notice:string;items:{journey_id:string;patient_name:string;document:string;surgery_date:string;channel:string;message:{subject:string;body:string}}[]};
export default function Copilot(){
  const [query,setQuery]=useState("Prépare les relances des dossiers incomplets opérés dans les 7 prochains jours");
  const [plan,setPlan]=useState<Plan|null>(null);const [confirm,setConfirm]=useState(false);const toast=useToast(); const qc=useQueryClient();
  const preview=useMutation({mutationFn:()=>api<Plan>("/copilot/preview",{method:"POST",body:JSON.stringify({query})}),onSuccess:setPlan});
  const apply=useMutation({mutationFn:()=>api<{created:number;skipped:number;sent:number}>(`/copilot/plans/${plan?.id}/apply`,{method:"POST"}),onSuccess:r=>{setConfirm(false);setPlan(null);["proposals","cockpit"].forEach(k=>qc.invalidateQueries({queryKey:[k]}));toast({tone:"success",title:`${r.created} brouillon(s) préparé(s)`,text:`${r.skipped} dossier(s) actualisé(s) ignoré(s). Aucun message envoyé.`});}});
  return <div className="space-y-5"><div><Pill tone="mint"><Sparkles size={12}/>Copilote d'action</Pill><h1 className="mt-2 text-[28px] font-semibold tracking-tight">Dites ce que vous voulez préparer.</h1><p className="mt-1 text-ink-2">Le copilote sélectionne les dossiers, vous montre les messages et attend votre confirmation.</p></div>
    <Card className="p-5"><form onSubmit={e=>{e.preventDefault();preview.mutate();}} className="space-y-3"><label htmlFor="command" className="font-semibold">Votre demande</label><textarea id="command" maxLength={500} value={query} onChange={e=>setQuery(e.target.value)} className="min-h-24 w-full rounded-card border border-line-strong p-3"/>
      <div className="flex flex-wrap gap-2">{["Prépare les relances des dossiers incomplets opérés cette semaine","Prépare les relances pour demain"].map(s=><button type="button" key={s} onClick={()=>{setQuery(s);setPlan(null);}} className="rounded-full border border-line-strong px-3 py-1 text-meta hover:bg-mint-100">{s}</button>)}</div>
      <Button disabled={preview.isPending}><Sparkles size={16}/>{preview.isPending?"Préparation…":"Voir les actions proposées"}</Button></form><p className="mt-3 text-meta text-ink-2">Les dossiers sont sélectionnés selon leurs échéances et les pièces manquantes, avec des modèles administratifs approuvés. Les brouillons restent à valider avant envoi.</p></Card>
    {preview.isError&&<p role="alert" className="text-critical-text">{preview.error instanceof ApiError?preview.error.detail:"Préparation impossible"}</p>}
    {plan && (!plan.supported?<Card className="p-5">{plan.message}</Card>:<section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{plan.items.length} dossier(s) concerné(s)</h2><Pill tone="info">{plan.start} → {plan.end}</Pill></div>
      {plan.items.length===0&&<Card className="p-5">Aucune relance à préparer dans cette période. Les dossiers sans pièce échue, déjà en attente de validation ou relancés récemment sont exclus.</Card>}
      {plan.items.map(i=><Card key={i.journey_id} className="p-5"><Link to={`/parcours/${i.journey_id}`} className="font-semibold text-navy-900 hover:underline">{i.patient_name}</Link><p className="text-ink-2">{i.document} · intervention le {i.surgery_date} · {i.channel}</p><blockquote className="mt-3 whitespace-pre-wrap rounded-ctl bg-page p-3">{i.message.body}</blockquote></Card>)}
      {plan.items.length>0&&<Button onClick={()=>setConfirm(true)}><ShieldCheck size={16}/>Préparer ces brouillons</Button>}</section>)}
    <Link to="/validation" className="inline-flex items-center gap-2 font-semibold text-teal-700">Ouvrir la file de validation<ArrowRight size={16}/></Link>
    <Confirm open={confirm} title="Préparer ces relances ?" confirmLabel="Confirmer la préparation" busy={apply.isPending} onCancel={()=>setConfirm(false)} onConfirm={()=>apply.mutate()}>{plan?.items.length} brouillon(s) seront ajoutés à la file de validation. Les dossiers modifiés depuis l'aperçu seront ignorés. Aucun message ne sera envoyé.</Confirm>
    {apply.isError&&<p role="alert" className="text-critical-text">{apply.error instanceof ApiError?apply.error.detail:"Action impossible"}</p>}
  </div>;
}
