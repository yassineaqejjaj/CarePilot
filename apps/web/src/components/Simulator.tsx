import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Play, Pause, RotateCcw, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Pill, Progress } from "@/components/ui";

type Step={offset_days:number;title:string;kind:string;blocking:boolean};
type Simulation={events:{day:number;date:string;title:string;kind:string;event:string;blocking:boolean;state:string}[];writes:number;sent:number};
export default function Simulator({steps,onClose}:{steps:Step[];onClose:()=>void}){
  const [scenario,setScenario]=useState("missing_document");const [pos,setPos]=useState(0);const [playing,setPlaying]=useState(false);
  const run=useMutation({mutationFn:()=>api<Simulation>("/simulator",{method:"POST",body:JSON.stringify({steps,surgery_date:new Date().toISOString().slice(0,10),scenario})}),onSuccess:()=>{setPos(0);setPlaying(true);}});
  useEffect(()=>{if(!playing||!run.data?.events.length)return;const timer=setInterval(()=>setPos(p=>{if(p>=run.data!.events.length-1){setPlaying(false);return p;}return p+1;}),1000);return()=>clearInterval(timer);},[playing,run.data]);
  const events=run.data?.events??[],current=events[pos];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4" role="dialog" aria-modal="true" aria-label="Simuler le parcours"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto glass-sheet rounded-panel p-6">
    <div className="flex items-center justify-between"><h2 className="text-[22px] font-semibold">Le parcours prend vie</h2><button aria-label="Fermer le simulateur" onClick={onClose}><X size={20}/></button></div><p className="mt-1 text-ink-2">Simulation isolée : aucun dossier modifié, aucun message envoyé. Inclut les étapes non enregistrées du concepteur.</p>
    <div className="my-4 flex flex-wrap items-center gap-3"><select aria-label="Scénario" value={scenario} onChange={e=>{setScenario(e.target.value);setPlaying(false);run.reset();}} className="h-10 rounded-ctl border border-line-strong px-3"><option value="missing_document">Pièces manquantes</option><option value="on_time">Tout arrive à temps</option></select><Button disabled={run.isPending} onClick={()=>run.mutate()}><Play size={16}/>Lancer la simulation</Button></div>
    {current&&<><div className="rounded-panel bg-navy-900 p-5 text-white"><Pill tone="mint">J{current.day>=0?"+":""}{current.day}</Pill><h3 className="mt-3 text-xl font-semibold text-white">{current.title}</h3><p className="mt-1 text-white/80">{current.event}</p><p className="mt-2 text-meta text-white/60">{current.date}</p></div>
      <div className="mt-4 flex items-center gap-3"><Button size="sm" variant="secondary" onClick={()=>setPlaying(!playing)}>{playing?<Pause size={14}/>:<Play size={14}/>} {playing?"Pause":"Reprendre"}</Button><button aria-label="Recommencer" onClick={()=>{setPos(0);setPlaying(true);}}><RotateCcw size={16}/></button><span className="text-meta">{pos+1}/{events.length}</span></div>
      <input aria-label="Étape simulée" type="range" className="mt-3 w-full accent-teal-700" min={0} max={Math.max(events.length-1,0)} value={pos} onChange={e=>{setPlaying(false);setPos(Number(e.target.value));}}/>
      <ol className="mt-3 max-h-60 space-y-2 overflow-y-auto">{events.map((e,i)=><li key={i} className={`flex items-center gap-3 rounded-ctl border p-3 ${i===pos?"border-teal-500 bg-mint-100":"border-line"}`}><span className="w-10 text-meta font-semibold">J{e.day>=0?"+":""}{e.day}</span><span className="flex-1">{e.title}</span>{i<=pos&&<Pill tone={e.state==="attention"?"warning":"success"}>{e.state==="attention"?"À relancer":"Simulé"}</Pill>}</li>)}</ol></>}
    {run.isError&&<p role="alert" className="text-critical-text">Simulation indisponible.</p>}
  </div></div>;
}
