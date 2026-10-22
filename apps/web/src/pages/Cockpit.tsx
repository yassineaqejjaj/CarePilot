import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, ChevronRight, Download, FileText, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { displayName } from "@/auth";
import type { Cockpit, JourneyList } from "@/lib/types";
import { useProposal } from "@/lib/useProposal";
import { longDate, shortDate, jLabel, dayMonth } from "@/lib/format";
import { AiTag, Avatar, Button, Card, Confirm, ErrorState, Pill, PriorityTag, Progress, Skeleton, useToast } from "@/components/ui";
import JourneysTable from "@/components/JourneysTable";

function Kpi({ label, value, children, warn }: { label: string; value: number; children?: React.ReactNode; warn?: boolean }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-ink-2">{warn && <AlertTriangle size={14} className="text-critical" />}{label}</p>
      <p className="mt-2 text-[40px] font-bold leading-none tracking-tight text-navy-900 tabular-nums">{value}</p>
      <div className="mt-2">{children}</div>
    </Card>
  );
}

export default function CockpitPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { approve } = useProposal();
  const [confirm, setConfirm] = useState<string | null>(null);
  const { data, error, refetch } = useQuery({ queryKey: ["cockpit"], queryFn: () => api<Cockpit>("/cockpit") });
  const list = useQuery({ queryKey: ["journeys"], queryFn: () => api<JourneyList>("/journeys") });
  if (error) return <ErrorState onRetry={refetch} />;
  if (!data) return <div className="space-y-4"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;
  const { kpis: k, assistant: a } = data;
  const first = displayName().split(" ")[0] || "";
  const urgentCount = data.queue.filter((q) => q.priority === "urgent" || q.priority === "high").length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-ink-2">{longDate(data.date)}</p>
          <h1 className="text-[28px] font-semibold tracking-tight">Bonjour {first}, {urgentCount} parcours attendent votre action</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => toast({ tone: "warning", title: "Export non disponible dans cette démo" })}><Download size={16} />Exporter</Button>
          <Button onClick={() => toast({ tone: "warning", title: "Création de parcours", text: "Disponible via l'API ; l'écran dédié arrive bientôt." })}><Plus size={16} />Nouveau parcours</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Parcours actifs" value={k.active}><Pill tone="success">{k.finished_week} terminés cette semaine</Pill></Kpi>
        <Kpi label="En bonne voie" value={k.on_track}><div className="flex items-center gap-2"><Progress value={k.on_track_pct} /><span className="text-meta tabular-nums">{k.on_track_pct} %</span></div></Kpi>
        <Kpi label="Dossiers incomplets" value={k.incomplete}><Pill tone="warning">à relancer</Pill></Kpi>
        <Kpi label="Tâches à traiter" value={k.tasks_to_treat} warn><Pill tone="critical">{k.urgent} urgentes</Pill></Kpi>
        <Kpi label="Échéances sous 72 h" value={k.deadlines_72h}><span className="text-meta text-ink-2">{k.next_deadline ? `Prochaine : ${dayMonth(k.next_deadline)}` : "Aucune"}</span></Kpi>
        <Kpi label="Terminés cette semaine" value={k.finished_week}><span className="text-meta text-ink-2">Parcours clôturés</span></Kpi>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex items-start justify-between p-5 pb-3">
            <div><h2 className="text-lg font-semibold">File prioritaire</h2><p className="text-ink-2">Classée par échéance et impact sur la date d'intervention</p></div>
            <Link to="/parcours" className="flex items-center gap-1 whitespace-nowrap font-semibold text-teal-700 hover:underline">Voir les {k.tasks_to_treat} tâches <ChevronRight size={15} /></Link>
          </div>
          <ul>
            {data.queue.slice(0, 6).map((q) => (
              <li key={q.journey_id} className="grid gap-3 border-t border-line p-5 md:grid-cols-[1fr_auto]">
                <div>
                  <PriorityTag priority={q.priority}>{q.priority === "ready" ? `${q.priority_label} · J-${q.days_to_surgery}` : `${q.priority_label} · J-${q.days_to_surgery}`}</PriorityTag>
                  <Link to={`/parcours/${q.journey_id}`} className="mt-2 block text-base font-semibold text-navy-900 hover:underline">{q.patient_name}</Link>
                  <p className="text-ink-2">{q.procedure} · {shortDate(q.surgery_date)}</p>
                  {q.note && <p className="mt-2 flex items-center gap-1.5 text-meta text-ink-2">{q.proposal_id ? <Sparkles size={12} className="text-teal-700" /> : null}{q.note}</p>}
                  <div className="mt-3">
                    {q.priority === "ready" ? <Button size="sm" onClick={() => nav(`/parcours/${q.journey_id}`)}>Valider le dossier</Button>
                      : q.proposal_id ? <Button size="sm" onClick={() => nav(`/parcours/${q.journey_id}`)}>{q.proposal_kind === "message_draft" ? "Relire la relance" : "Relire la vérification"}</Button>
                      : <Button size="sm" variant="secondary" onClick={() => nav(`/parcours/${q.journey_id}`)}>Ouvrir le dossier</Button>}
                  </div>
                </div>
                <div className="flex min-w-[280px] items-center gap-4">
                  <div className="w-36">
                    <div className="flex items-center gap-2"><Progress value={q.progress} /><span className="text-meta tabular-nums">{q.progress} %</span></div>
                    {q.next_doc && <span className="mt-2 inline-flex items-center gap-1 rounded-tag bg-surface-2 px-2 py-0.5 text-meta"><FileText size={12} />{q.next_doc}</span>}
                  </div>
                  <span className="flex items-center gap-2"><Avatar name={q.owner} />{q.owner}</span>
                </div>
              </li>))}
            {data.queue.length === 0 && <li className="border-t border-line p-8 text-center text-ink-2">Aucune tâche en attente. Tous les parcours du jour sont à jour.</li>}
          </ul>
        </Card>

        <aside className="self-start rounded-panel bg-navy-900 p-5 text-white shadow-menu" aria-label="CarePilot Assistant">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-ctl bg-white/10 text-signal"><Sparkles size={16} /></span>
            <div><p className="font-semibold">CarePilot Assistant</p><p className="text-meta text-white/70">{data.assistant.proposal || a.to_chase ? `${(a.proposal ? 1 : 0) + 3} recommandations` : "Aucune recommandation"}</p></div>
          </div>
          {a.proposal && (
            <div className="mt-4 rounded-card border border-dashed border-signal/60 bg-white/5 p-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-100 px-2 py-0.5 text-meta font-semibold text-teal-800"><ShieldCheck size={12} />Validation humaine requise</span>
              <p className="mt-2 text-white/90">
                {a.proposal.kind === "message_draft" ? <>Relance préparée pour <strong>{a.proposal.patient_name}</strong> : {a.proposal.payload.subject?.toLowerCase()}.</> :
                  <>Vérification préparée pour <strong>{a.proposal.patient_name}</strong>.</>}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={() => nav(a.proposal!.journey_id ? `/parcours/${a.proposal!.journey_id}` : "/validation")}>Relire</Button>
                <Button size="sm" className="bg-signal text-navy-900 hover:bg-mint-300" onClick={() => setConfirm(a.proposal!.id)}>Approuver et envoyer</Button>
              </div>
            </div>)}
          {[["Information", `${a.to_chase} dossiers administratifs doivent être relancés avant vendredi.`, `Voir les ${a.to_chase} dossiers`, "/parcours"],
            ["Prêt pour revue", `${a.no_response} patients n'ont pas répondu à leur demande de documents depuis plus de 72 h.`, "Préparer les relances", "/validation"],
            ["Prêt pour revue", `${a.ready} parcours ont tous leurs documents et sont prêts pour la validation administrative.`, "Ouvrir la file de validation", "/validation"]].map(([tag, text, cta, to]) => (
            <div key={text} className="mt-4 border-t border-white/10 pt-4">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-meta font-semibold">{tag}</span>
              <p className="mt-2 text-white/90">{text}</p>
              <Link to={to} className="mt-1 inline-flex items-center gap-1 font-semibold text-signal hover:underline">{cta} <ArrowRight size={14} /></Link>
            </div>))}
          <p className="mt-5 border-t border-white/10 pt-3 text-meta text-white/60">CarePilot coordonne uniquement les tâches administratives. Aucun diagnostic, aucun envoi sans validation de votre équipe.</p>
        </aside>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Parcours patients</h2><Link className="font-semibold text-teal-700 hover:underline" to="/parcours">Tout voir</Link></div>
        {list.data ? <JourneysTable data={list.data} limit={6} /> : <Skeleton className="h-64" />}
      </section>

      <Confirm open={!!confirm} title="Approuver et envoyer cette relance ?" confirmLabel="Approuver et envoyer" busy={approve.isPending}
        onCancel={() => setConfirm(null)} onConfirm={() => approve.mutate(confirm!, { onSettled: () => setConfirm(null) })}>
        Le message préparé par CarePilot sera validé en votre nom. <strong>Démo :</strong> l'envoi par SMS et e-mail est simulé, aucun message réel n'est envoyé.
      </Confirm>
    </div>
  );
}
