import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Circle, FileText } from "lucide-react";
import { api } from "@/lib/api";
import type { JourneyDetail } from "@/lib/types";
import { useProposal } from "@/lib/useProposal";
import { dateTime, dayMonth, longDate } from "@/lib/format";
import { AiTag, Button, Card, Confirm, ErrorState, Pill, Progress, Skeleton, STATE_TONE, useToast, type Tone } from "@/components/ui";
import { cn } from "@/lib/utils";

const DOC_TONE: Record<string, Tone> = { "Validé": "success", "En revue": "info", "Manquant": "critical" };
const TAG_TONE: Record<string, Tone> = { "Action équipe": "mint", Patient: "info", "Automatique": "neutral" };

export default function JourneyDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { approve, reject } = useProposal();
  const [confirm, setConfirm] = useState(false);
  const { data: d, error, refetch } = useQuery({ queryKey: ["journey", id], queryFn: () => api<JourneyDetail>(`/journeys/${id}/detail`) });
  if (error) return <ErrorState onRetry={refetch} />;
  if (!d) return <div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-32" /><Skeleton className="h-96" /></div>;
  const na = d.next_action;
  const facts: [string, string, string][] = [
    ["Intervention", d.procedure, "Chirurgie ambulatoire"],
    ["Date", longDate(d.surgery_date).replace(/^(\w+)/, (w) => w.slice(0, 3) + "."), `Admission ${d.admission_time} · ${d.days_to_surgery >= 0 ? "J-" + d.days_to_surgery : "J+" + -d.days_to_surgery}`],
    ["Coordinateur", d.owner, `Chirurgien : ${d.surgeon}`],
  ];
  return (
    <div className="space-y-6">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-ink-2">
        <Link to="/parcours" className="hover:underline">Parcours patients</Link><ChevronRight size={14} /><span className="font-semibold text-navy-900">{d.patient.name}</span>
      </nav>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">{d.patient.name}</h1>
          <Pill tone={STATE_TONE[d.state]}>{d.state_label}</Pill>
        </div>
        <p className="mt-1 text-meta tabular-nums text-ink-2">
          {d.patient.birth_date ? `Né(e) le ${new Date(d.patient.birth_date + "T12:00:00").toLocaleDateString("fr-FR")} · ` : ""}{d.reference} · Patient fictif
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {facts.map(([l, v, s]) => (
            <div key={l}><p className="text-[11px] font-semibold uppercase tracking-wider text-ink-2">{l}</p><p className="mt-1 font-semibold text-navy-900">{v}</p><p className="text-meta text-ink-2">{s}</p></div>))}
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-ink-2">Progression</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums text-navy-900">{d.progress.pct} %</p>
            <Progress value={d.progress.pct} className="mt-1" />
            <p className="mt-1 text-meta text-ink-2">{d.progress.done} validés sur {d.progress.total} · {d.progress.missing} manquant{d.progress.missing > 1 ? "s" : ""}</p></div>
        </div>
      </Card>

      {na && (
        <section className="rounded-panel border border-dashed border-teal-500/60 bg-mint-100/60 p-5" aria-label="Prochaine action administrative">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-800">Prochaine action administrative</p>
          <div className="mt-1"><AiTag>Suggestion CarePilot · validation humaine requise</AiTag></div>
          {na.kind === "message_draft" ? (
            <>
              <h2 className="mt-3 text-[22px] font-semibold">Relancer {d.patient.name.split(" ")[0]} pour son {na.payload.subject?.replace(/^Votre /, "").toLowerCase()}</h2>
              <p className="mt-1 text-ink-2">Relance préparée à partir d'un modèle approuvé, à relire avant envoi.</p>
              <p className="mt-2 text-meta text-ink-2">Canal : {na.payload.channel ?? "SMS + e-mail"} · Envoi : immédiat après validation · Modèle : {na.payload.model ?? "—"}</p>
              <blockquote className="mt-3 whitespace-pre-wrap rounded-card border border-line bg-white p-4">{na.payload.body}</blockquote>
            </>
          ) : (
            <>
              <h2 className="mt-3 text-[22px] font-semibold">Vérification administrative préparée</h2>
              <p className="mt-1 text-ink-2">{na.payload.summary}</p>
              <ul className="mt-2 list-disc pl-5">{(na.payload.anomalies ?? []).map((x: string) => <li key={x}>{x}</li>)}</ul>
            </>)}
          <div className="mt-4 flex gap-2">
            <Button variant="danger" onClick={() => reject.mutate(na.proposal_id)} disabled={reject.isPending}>Rejeter</Button>
            <Button variant="secondary" onClick={() => toast({ tone: "warning", title: "Modification du texte", text: "Non disponible dans cette démo : rejetez et relancez la préparation." })}>Modifier</Button>
            <Button onClick={() => setConfirm(true)}>Approuver et envoyer</Button>
          </div>
        </section>)}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Chronologie du parcours</h2>
          <p className="text-ink-2">Modèle : Préparation chirurgie ambulatoire · v{d.template_version}</p>
          <ol className="mt-4">
            {d.timeline.map((t, i) => (
              <li key={t.id} className="relative flex gap-3 pb-5 last:pb-0">
                {i < d.timeline.length - 1 && <span className="absolute left-[11px] top-6 h-full w-px bg-line" aria-hidden />}
                <span className={cn("z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                  t.status === "done" ? "border-teal-500 bg-teal-500 text-white" : t.status === "action" ? "border-teal-500 bg-white" : "border-line-strong bg-white")}>
                  {t.status === "done" ? <Check size={13} strokeWidth={3} /> : t.status === "action" ? <Circle size={8} className="fill-teal-500 text-teal-500" /> : null}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="rounded-tag bg-navy-900 px-1.5 text-meta font-semibold text-white tabular-nums">{t.label}</span>
                    <span className="font-semibold text-navy-900">{t.title}</span>
                    <Pill tone={t.status === "done" ? "success" : t.status === "action" ? "warning" : "neutral"}>{t.status === "done" ? "Terminé" : t.status === "action" ? "Action requise" : "À venir"}</Pill>
                  </p>
                  <p className="text-meta text-ink-2">Échéance : <strong>{dayMonth(t.due_date)}</strong> · Responsable : <strong>{t.owner}</strong></p>
                  {t.detail && <p className="text-meta text-ink-2">{t.detail}</p>}
                </div>
              </li>))}
          </ol>
        </Card>

        <div className="space-y-6 self-start">
          <Card className="p-5">
            <h2 className="text-lg font-semibold">Documents attendus</h2>
            <p className="text-ink-2">{d.progress.done} validés sur {d.progress.total} · {d.progress.missing} manquant{d.progress.missing > 1 ? "s" : ""}</p>
            <ul className="mt-3 divide-y divide-line">
              {d.documents.map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-2.5"><FileText size={16} className="text-ink-2" /><span className="flex-1">{x.title}</span><Pill tone={DOC_TONE[x.status]}>{x.status}</Pill></li>))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="text-lg font-semibold">Activité récente</h2>
            <ul className="mt-3 space-y-4">
              {d.activity.length === 0 && <li className="text-ink-2">Aucune activité pour le moment.</li>}
              {d.activity.map((a, i) => (
                <li key={i}><p className="flex items-center gap-2"><span className="font-semibold text-navy-900">{a.actor || "—"}</span><Pill tone={TAG_TONE[a.tag] ?? "neutral"}>{a.tag}</Pill></p>
                  <p>{a.text}</p><p className="text-meta tabular-nums text-ink-2">{dateTime(a.at)}</p></li>))}
            </ul>
          </Card>
        </div>
      </div>

      <Confirm open={confirm} title="Approuver et envoyer cette relance ?" confirmLabel="Approuver et envoyer" busy={approve.isPending}
        onCancel={() => setConfirm(false)} onConfirm={() => na && approve.mutate(na.proposal_id, { onSettled: () => setConfirm(false) })}>
        Vous validez ce message en votre nom. <strong>Démo :</strong> l'envoi par SMS et e-mail est simulé, aucun message réel n'est envoyé.
      </Confirm>
    </div>
  );
}
