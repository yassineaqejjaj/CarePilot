import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { roles } from "@/auth";
import { Button, Card, Pill } from "@/components/ui";

type Procedure={id:string;topic:string;title:string;status:string;version:number;content:{fr:string;darija:string};approved_by:string};
export default function Procedures(){
 const qc=useQueryClient();const [form,setForm]=useState({title:"",topic:"documents",fr:"",darija:""});const admin=roles().includes("admin");
 const q=useQuery({queryKey:["procedures"],queryFn:()=>api<Procedure[]>("/procedures")});
 const save=useMutation({mutationFn:()=>api("/procedures",{method:"POST",body:JSON.stringify(form)}),onSuccess:()=>{setForm({...form,title:"",fr:"",darija:""});qc.invalidateQueries({queryKey:["procedures"]});}});
 const approve=useMutation({mutationFn:(id:string)=>api(`/procedures/${id}/approve`,{method:"POST"}),onSuccess:()=>qc.invalidateQueries({queryKey:["procedures"]})});
 return <div className="space-y-5"><h1 className="text-[28px] font-semibold tracking-tight">Procédures de l'assistant patient</h1><p className="text-ink-2">L'assistant cite uniquement les réponses approuvées de votre établissement. Une nouvelle approbation remplace la version active du même sujet.</p>
 {q.data?.map(c=><Card key={c.id} className="space-y-2 p-5"><div className="flex items-center gap-3"><h2 className="font-semibold">{c.title}</h2><Pill tone={c.status==="approved"?"success":"neutral"}>{c.status} · v{c.version}</Pill></div><p>{c.content.fr}</p><p dir="rtl">{c.content.darija}</p>{admin&&c.status==="draft"&&<Button size="sm" disabled={approve.isPending} onClick={()=>approve.mutate(c.id)}>Approuver cette procédure</Button>}</Card>)}
 {admin&&<Card className="p-5"><h2 className="mb-3 text-lg font-semibold">Nouvelle version de procédure</h2><form className="space-y-3" onSubmit={e=>{e.preventDefault();save.mutate();}}><input aria-label="Titre de la procédure" placeholder="Titre" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="h-10 w-full rounded-ctl border border-line-strong px-3"/><select aria-label="Sujet" value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})} className="h-10 rounded-ctl border border-line-strong px-3"><option value="documents">Documents</option><option value="insurance">Assurance / AMO</option><option value="arrival">Admission</option><option value="privacy">Données personnelles</option></select><textarea aria-label="Réponse française" placeholder="Réponse française approuvable" required value={form.fr} onChange={e=>setForm({...form,fr:e.target.value})} className="min-h-24 w-full rounded-ctl border border-line-strong p-3"/><textarea aria-label="Réponse darija" placeholder="الجواب بالدارجة" dir="rtl" value={form.darija} onChange={e=>setForm({...form,darija:e.target.value})} className="min-h-24 w-full rounded-ctl border border-line-strong p-3"/><Button disabled={save.isPending}>Créer un brouillon</Button></form>{save.isError&&<p role="alert" className="text-critical-text">Création impossible.</p>}</Card>}
 </div>;
}
