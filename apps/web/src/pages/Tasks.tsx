import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { dayMonth } from "@/lib/format";
import { Button, Card, EmptyState, ErrorState, Pill, Skeleton, useToast } from "@/components/ui";

type Task = { id: string; journey_id: string; patient_name: string; title: string; kind: string; status: string; due_date: string; days_late: number; blocking: boolean; owner: string };

export default function TasksPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, error, refetch } = useQuery({ queryKey: ["tasks"], queryFn: () => api<Task[]>("/tasks") });
  const done = useMutation({
    mutationFn: (id: string) => api(`/tasks/${id}/complete`, { method: "POST" }),
    onSuccess: () => { ["tasks", "cockpit", "journeys"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast({ tone: "success", title: "Tâche validée" }); },
  });
  return (
    <div className="space-y-5">
      <div><h1 className="text-[28px] font-semibold tracking-tight">Tâches</h1><p className="text-ink-2">En retard ou à échéance sous 7 jours, sur tous les parcours actifs.</p></div>
      {error ? <ErrorState onRetry={refetch} /> : !data ? <Skeleton className="h-64" /> : data.length === 0 ? <EmptyState title="Aucune tâche en attente" text="Tous les parcours du jour sont à jour." /> : (
        <Card className="overflow-x-auto"><table className="w-full text-left">
          <thead className="text-meta uppercase tracking-wide text-ink-2"><tr>{["Patient", "Tâche", "Échéance", "Statut", "Responsable", ""].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{data.map((t) => (
            <tr key={t.id} className="border-t border-line">
              <td className="px-4 py-3"><Link className="font-semibold text-navy-900 hover:underline" to={`/parcours/${t.journey_id}`}>{t.patient_name}</Link></td>
              <td className="px-4 py-3">{t.title}{t.blocking && <Pill tone="critical" className="ml-2">Bloquant</Pill>}</td>
              <td className="px-4 py-3 tabular-nums">{dayMonth(t.due_date)}{t.days_late > 0 && <span className="ml-2 text-critical-text">+{t.days_late} j</span>}</td>
              <td className="px-4 py-3"><Pill tone={t.status === "submitted" ? "info" : t.days_late > 0 ? "warning" : "neutral"}>{t.status === "submitted" ? "À vérifier" : t.days_late > 0 ? "En retard" : "À venir"}</Pill></td>
              <td className="px-4 py-3">{t.owner}</td>
              <td className="px-4 py-3 text-right"><Button size="sm" variant="secondary" disabled={done.isPending} onClick={() => done.mutate(t.id)}>Marquer fait</Button></td>
            </tr>))}</tbody></table></Card>)}
    </div>
  );
}
