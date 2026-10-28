import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, Pill, Skeleton, useToast } from "@/components/ui";

type S = { name: string; city: string; cndp_ref: string; cndp_transfer_ref: string; dpo_contact: string; retention_days: number; ai_enabled: boolean; ai_effective: boolean; ai_blocked_reason: string; notice_version: string; messaging_provider: string; demo_mode: boolean };
type Req = { id: string; kind: string; message: string; status: string; resolution: string; created_at: string; patient_name: string };
const KIND: Record<string, string> = { access: "Accès", rectification: "Rectification", opposition: "Opposition", deletion: "Effacement" };
const input = "mt-1 h-10 w-full rounded-ctl border border-line-strong px-3";

export default function SettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, error, refetch } = useQuery({ queryKey: ["settings"], queryFn: () => api<S>("/settings") });
  const reqs = useQuery({ queryKey: ["data-requests"], queryFn: () => api<Req[]>("/data-requests") });
  const [f, setF] = useState<S | null>(null);
  useEffect(() => { if (data) setF(data); }, [data]);
  const save = useMutation({
    mutationFn: () => api<S>("/settings", { method: "PUT", body: JSON.stringify(f) }),
    onSuccess: (s) => { qc.setQueryData(["settings"], s); qc.invalidateQueries({ queryKey: ["me"] }); toast({ tone: "success", title: "Paramètres enregistrés" }); },
    onError: () => toast({ tone: "critical", title: "Enregistrement impossible", text: "Vérifiez la durée de conservation (30 à 3650 jours)." }),
  });
  const resolve = useMutation({
    mutationFn: ({ id, status, anonymize }: { id: string; status: "done" | "rejected"; anonymize?: boolean }) => api(`/data-requests/${id}/resolve`, { method: "POST", body: JSON.stringify({ status, anonymize: !!anonymize, resolution: status === "done" ? "Traitée" : "Refusée" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["data-requests"] }); toast({ tone: "success", title: "Demande traitée" }); },
    onError: () => toast({ tone: "critical", title: "Action impossible" }),
  });
  const purge = useMutation({
    mutationFn: (dry: boolean) => api<{ patients: number }>(`/admin/purge?dry_run=${dry}`, { method: "POST" }),
    onSuccess: (r, dry) => toast({ tone: "success", title: dry ? `${r.patients} dossier(s) à anonymiser` : `${r.patients} dossier(s) anonymisé(s)` }),
  });
  const reset = useMutation({
    mutationFn: () => api("/admin/demo-reset", { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries(); toast({ tone: "success", title: "Données de démonstration réinitialisées" }); },
  });
  if (error) return <ErrorState onRetry={refetch} />;
  if (!f) return <Skeleton className="h-96" />;
  const set = (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === "retention_days" ? Number(e.target.value) : e.target.value });
  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold tracking-tight">Paramètres</h1>
      <Link to="/demarrage" className="inline-block rounded-ctl border border-line px-4 py-3 text-teal-700">Préparer le premier pilote · contacts et horaires</Link>
      <Card><CardHeader><CardTitle>Conformité — loi 09-08 (CNDP)</CardTitle></CardHeader><CardContent>
        <p className="text-ink-2">Ces informations sont affichées au patient avant tout traitement. Le suivi des patients (données de santé) requiert l'autorisation préalable de la CNDP.</p>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <label>Ville<input className={input} value={f.city} onChange={set("city")} /></label>
          <label>Contact pour exercer les droits (e-mail ou téléphone)<input className={input} value={f.dpo_contact} onChange={set("dpo_contact")} /></label>
          <label>Référence d'autorisation CNDP du traitement<input className={input} value={f.cndp_ref} onChange={set("cndp_ref")} placeholder="ex. A-GC-123/2026" /></label>
          <label>Référence d'autorisation CNDP du transfert à l'étranger<input className={input} value={f.cndp_transfer_ref} onChange={set("cndp_transfer_ref")} placeholder="requise pour activer l'IA (OpenAI hors du Maroc)" /></label>
          <label>Conservation après clôture du parcours (jours)<input type="number" min={30} max={3650} className={input} value={f.retention_days} onChange={set("retention_days")} /></label>
          <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" checked={f.ai_enabled} onChange={(e) => setF({ ...f, ai_enabled: e.target.checked })} />Autoriser les fonctions IA pour cet établissement</label>
          <div className="flex items-center gap-3 md:col-span-2"><Button disabled={save.isPending}>Enregistrer</Button>
            <Pill tone={data!.ai_effective ? "success" : "warning"}>{data!.ai_effective ? "IA active" : "IA inactive"}</Pill>
            {data!.ai_blocked_reason && <span className="text-meta text-ink-2">{data!.ai_blocked_reason}</span>}</div>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4"><span className="text-ink-2">Conservation :</span>
          <Button variant="secondary" size="sm" onClick={() => purge.mutate(true)}>Simuler la purge</Button>
          <Button variant="danger" size="sm" onClick={() => { if (window.confirm("Anonymiser définitivement les dossiers clos hors délai de conservation ?")) purge.mutate(false); }}>Anonymiser les dossiers expirés</Button></div>
        <p className="mt-3 text-meta text-ink-2">Messagerie : <strong>{data!.messaging_provider === "live" ? "réelle (SMS / WhatsApp / e-mail)" : "simulée (démonstration)"}</strong> · version de la notice : {data!.notice_version}</p>
      </CardContent></Card>

      {data!.demo_mode && (
        <Card><CardHeader><CardTitle>Mode démonstration</CardTitle></CardHeader><CardContent>
          <p className="text-ink-2">Toutes les données sont fictives. Vous pouvez remettre la démonstration à son état initial (patients, parcours, messages, pièces).</p>
          <Button className="mt-3" variant="danger" disabled={reset.isPending} onClick={() => { if (window.confirm("Réinitialiser toutes les données de démonstration ?")) reset.mutate(); }}>Réinitialiser la démo</Button></CardContent></Card>)}

      <Card><CardHeader><CardTitle>Demandes d'exercice de droits</CardTitle></CardHeader><CardContent>
        {!reqs.data ? <Skeleton className="h-20" /> : reqs.data.length === 0 ? <EmptyState title="Aucune demande" /> : (
          <ul className="divide-y divide-line">{reqs.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <Pill tone={r.status === "open" ? "warning" : r.status === "done" ? "success" : "neutral"}>{r.status === "open" ? "Ouverte" : r.status === "done" ? "Traitée" : "Refusée"}</Pill>
              <div className="min-w-0 flex-1"><p><strong>{KIND[r.kind]}</strong> · {r.patient_name} <span className="text-meta text-ink-2">{dateTime(r.created_at)}</span></p>{r.message && <p className="text-ink-2">{r.message}</p>}</div>
              {r.status === "open" && <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => resolve.mutate({ id: r.id, status: "done" })}>Marquer traitée</Button>
                {r.kind === "deletion" && <Button size="sm" variant="danger" onClick={() => { if (window.confirm("Effacer définitivement les données identifiantes de ce patient ?")) resolve.mutate({ id: r.id, status: "done", anonymize: true }); }}>Effacer les données</Button>}
                <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: r.id, status: "rejected" })}>Refuser</Button></div>}
            </li>))}</ul>)}
      </CardContent></Card>
    </div>
  );
}
