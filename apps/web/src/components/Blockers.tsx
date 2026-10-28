import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Pill } from "@/components/ui";

type Explanation={summary:string;rule:string;items:{task_id:string;title:string;reason:string;owner:string;next_action:string;blocking:boolean;days_late:number;due_date:string}[]};
export default function Blockers({id}:{id:string}) {
  const q=useQuery({queryKey:["blockers",id],queryFn:()=>api<Explanation>(`/journeys/${id}/blockers`)});
  if(!q.data)return null;
  return <Card className="p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><AlertCircle size={18} className="text-warning"/>Pourquoi ce dossier demande votre attention</h2>
    <p className="mt-1 text-ink-2">{q.data.summary}</p>
    <ul className="mt-3 divide-y divide-line">{q.data.items.map(b=><li key={b.task_id} className="py-3"><div className="flex flex-wrap items-center gap-2"><strong>{b.title}</strong>{b.blocking&&<Pill tone="critical">Bloquant</Pill>}{b.days_late>0&&<Pill tone="warning">{b.days_late} j de retard</Pill>}</div>
      <p className="mt-1">{b.reason}</p><p className="mt-1 flex items-center gap-1 text-teal-700"><ArrowRight size={14}/>{b.next_action}</p><p className="text-meta text-ink-2">Responsable : {b.owner||"À affecter"} · échéance : {b.due_date}</p></li>)}</ul>
    <p className="mt-2 text-meta text-ink-2">{q.data.rule}</p></Card>;
}
