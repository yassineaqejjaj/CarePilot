import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { Button, Card, EmptyState, ErrorState, Pill, Skeleton, type Tone } from "@/components/ui";

type Msg = { id: string; at: string; kind: string; channel: string; to: string; status: "simulated" | "sent" | "delivered" | "failed"; error: string; subject: string; journey_id: string | null; patient_name: string };
const TONE: Record<string, Tone> = { sent: "info", delivered: "success", simulated: "info", failed: "critical" };
const LABEL: Record<string, string> = { sent: "Accepté par le fournisseur", delivered: "Livré", simulated: "Simulé", failed: "Échec" };
const CH: Record<string, string> = { whatsapp: "WhatsApp", sms: "SMS", email: "E-mail" };
const KIND: Record<string, string> = { reminder: "Relance", invitation: "Lien patient", info: "Information" };

export default function CommunicationsPage() {
  const qc = useQueryClient();
  const support = useQuery({queryKey:["support"],queryFn:()=>api<{id:string;patient_name:string;message:string;status:string;created_at:string}[]>("/support-requests")});
  const resolve = useMutation({mutationFn:(id:string)=>api(`/support-requests/${id}/resolve`,{method:"POST"}),onSuccess:()=>qc.invalidateQueries({queryKey:["support"]})});
  const { data, error, refetch } = useQuery({ queryKey: ["messages"], queryFn: () => api<Msg[]>("/messages") });
  return (
    <div className="space-y-5">
      <div><h1 className="text-[28px] font-semibold tracking-tight">Communications</h1>
        <p className="text-ink-2">Journal des messages envoyés aux patients. Les numéros sont masqués. « Simulé » = fournisseur de démonstration, rien n'est parti.</p></div>
      {support.data && support.data.some(r=>r.status === "open") && <Card className="p-5"><h2 className="mb-3 text-lg font-semibold">Demandes d’aide administratives</h2><ul className="divide-y divide-line">{support.data.filter(r=>r.status === "open").map(r=><li key={r.id} className="flex flex-wrap items-center gap-3 py-3"><div className="flex-1"><strong>{r.patient_name}</strong><p dir="auto">{r.message}</p></div><Button size="sm" variant="secondary" disabled={resolve.isPending} onClick={()=>resolve.mutate(r.id)}>Marquer traitée</Button></li>)}</ul></Card>}
      {error ? <ErrorState onRetry={refetch} /> : !data ? <Skeleton className="h-64" /> : data.length === 0 ? <EmptyState title="Aucun message" text="Les relances validées et les liens patient apparaîtront ici." /> : (
        <Card className="overflow-x-auto"><table className="w-full text-left">
          <thead className="text-meta uppercase tracking-wide text-ink-2"><tr>{["Date", "Patient", "Type", "Canal", "Destinataire", "Statut"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{data.map((m) => (
            <tr key={m.id} className="border-t border-line">
              <td className="px-4 py-3 tabular-nums">{dateTime(m.at)}</td>
              <td className="px-4 py-3">{m.journey_id ? <Link className="font-semibold text-navy-900 hover:underline" to={`/parcours/${m.journey_id}`}>{m.patient_name}</Link> : m.patient_name}</td>
              <td className="px-4 py-3">{KIND[m.kind] ?? m.kind}</td><td className="px-4 py-3">{CH[m.channel] ?? m.channel}</td>
              <td className="px-4 py-3 tabular-nums">{m.to || "—"}</td>
              <td className="px-4 py-3"><Pill tone={TONE[m.status]}>{LABEL[m.status]}</Pill>{m.error && <span className="ml-2 text-meta text-ink-2">{m.error}</span>}</td>
            </tr>))}</tbody></table></Card>)}
    </div>
  );
}
