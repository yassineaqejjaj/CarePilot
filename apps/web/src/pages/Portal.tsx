import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ClipboardList, Home, ListChecks, MessageSquare, Phone, Mail, Route as RouteIcon } from "lucide-react";
import { api } from "@/lib/api";
import { displayName, logout } from "@/auth";
import type { Portal } from "@/lib/types";
import { Avatar, Button, ErrorState, Logo, Pill, Progress, Skeleton, useToast } from "@/components/ui";
import { dayMonth, longDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "home" | "tasks" | "journey" | "messages";

export default function PortalPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("home");
  const { data, error, refetch } = useQuery({ queryKey: ["me-portal"], queryFn: () => api<Portal>("/portal/me") });
  const submit = useMutation({
    mutationFn: (id: string) => api(`/portal/tasks/${id}/submit`, { method: "POST", body: JSON.stringify({ response: {} }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me-portal"] }); toast({ tone: "success", title: "Merci, c'est envoyé", text: "Votre équipe va vérifier votre document." }); },
  });
  if (error) return <div className="p-4"><ErrorState onRetry={refetch} /></div>;
  if (!data) return <div className="space-y-3 p-4"><Skeleton className="h-16" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  const j = data.journeys[0];
  const first = displayName().split(" ")[0] || data.first_name;
  const todo = j?.tasks.find((t) => t.status === "todo" && t.can_submit);
  const label = { todo: "À faire", submitted: "En revue", done: "Fait" } as const;
  const Tasks = () => (
    <section aria-label="Mes tâches"><h2 className="mb-2 text-lg font-semibold">Mes tâches</h2>
      <ul className="overflow-hidden rounded-panel border border-line bg-white">
        {j?.tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 border-b border-line p-4 last:border-0">
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", t.status === "done" ? "bg-success-bg text-success-text" : "bg-surface-2 text-ink-2")}>{t.status === "done" ? <Check size={15} /> : <ClipboardList size={15} />}</span>
            <div className="flex-1"><p className="font-semibold text-navy-900">{t.title}</p><p className="text-meta text-ink-2">{t.status === "done" ? "Validé" : t.can_submit ? `Avant le ${dayMonth(t.due_date)}` : `Disponible le ${dayMonth(t.due_date)}`}</p></div>
            <Pill tone={t.status === "done" ? "success" : t.status === "submitted" ? "info" : t.can_submit ? "warning" : "neutral"}>{t.can_submit || t.status !== "todo" ? label[t.status] : "Bientôt"}</Pill>
          </li>))}
      </ul></section>
  );
  return (
    <div className="mx-auto flex min-h-screen max-w-[430px] flex-col bg-page">
      <header className="flex items-center gap-3 border-b border-line bg-white px-4 py-3">
        <Logo size={32} /><div className="flex-1 leading-tight"><p className="font-semibold text-navy-900">{data.establishment}</p><p className="text-meta text-ink-2">Mon parcours · CarePilot</p></div>
        <button aria-label="Déconnexion" onClick={() => logout()}><Avatar name={displayName() || data.first_name} className="h-9 w-9" /></button>
      </header>
      <main className="flex-1 space-y-5 px-4 pb-24 pt-5 text-patient">
        <h1 className="text-[22px] font-semibold leading-snug">Bonjour {first}, voici les prochaines étapes de votre parcours.</h1>
        {!j ? <p>Aucun parcours en cours.</p> : (<>
          {(tab === "home") && (todo ? (
            <section className="rounded-panel bg-navy-900 p-5 text-white shadow-menu" aria-label="À faire en priorité">
              <p className="text-meta font-semibold uppercase tracking-wider text-signal">À faire avant le {dayMonth(todo.due_date)}</p>
              <h2 className="mt-1 text-[20px] font-semibold text-white">{todo.kind === "document" ? "Déposez" : "Complétez"} : {todo.title.toLowerCase()}</h2>
              <p className="mt-1 text-white/80">Une photo nette suffit. Elle permet de finaliser votre dossier d'admission.</p>
              <Button size="patient" className="mt-4 bg-signal text-navy-900 hover:bg-mint-300" disabled={submit.isPending} onClick={() => submit.mutate(todo.id)}>
                <Camera size={18} />{todo.kind === "document" ? "Prendre une photo ou choisir un fichier" : "Marquer comme complété"}</Button>
              <p className="mt-2 text-meta text-white/60">Démo : le fichier n'est pas réellement transféré, votre confirmation est enregistrée.</p>
            </section>) : (
            <section className="rounded-panel border border-line bg-white p-5"><p className="font-semibold text-navy-900">Tout est à jour 🎉</p><p className="text-ink-2">Vous n'avez rien à faire pour le moment.</p></section>))}
          {(tab === "home" || tab === "journey") && (
            <section className="rounded-panel border border-line bg-white p-5" aria-label="Votre préparation">
              <div className="flex items-baseline justify-between"><h2 className="font-semibold text-navy-900">Votre préparation</h2><span className="tabular-nums text-ink-2">{j.progress.done} sur {j.progress.total} étapes</span></div>
              <Progress value={j.progress.total ? (100 * j.progress.done) / j.progress.total : 0} className="mt-3 h-2" />
              <p className="mt-3 text-ink-2">Intervention le {longDate(j.surgery_date).toLowerCase()} · arrivée à {j.admission_time}</p>
              <p className="text-ink-2">{j.procedure}</p>
            </section>)}
          {(tab === "home" || tab === "tasks") && <Tasks />}
          {(tab === "home" || tab === "journey") && (
            <section aria-label="Dates importantes"><h2 className="mb-2 text-lg font-semibold">Dates importantes</h2>
              {[[-1, "Vous recevrez vos informations pratiques (accès, horaires, documents à apporter)."], [0, `Admission à ${j.admission_time} — accueil du service ambulatoire.`]].map(([off, text]) => {
                const d = new Date(j.surgery_date + "T12:00:00"); d.setDate(d.getDate() + (off as number));
                return (<div key={String(off)} className="mb-2 flex gap-3 rounded-panel border border-line bg-white p-3">
                  <div className="w-12 rounded-ctl bg-mint-100 py-1 text-center text-teal-800"><p className="text-[10px] font-semibold uppercase">{d.toLocaleDateString("fr-FR", { month: "short" })}</p><p className="text-lg font-bold tabular-nums">{d.getDate()}</p></div>
                  <p className="flex-1 self-center">{text as string}</p></div>);
              })}</section>)}
          {tab === "messages" && (
            <section aria-label="Messages"><h2 className="mb-2 text-lg font-semibold">Messages</h2>
              {j.messages.length === 0 ? <p className="rounded-panel border border-line bg-white p-4 text-ink-2">Aucun message pour le moment.</p> :
                j.messages.map((m, i) => <div key={i} className="mb-2 rounded-panel border border-line bg-white p-4"><p className="font-semibold text-navy-900">{m.subject}</p><p className="mt-1 whitespace-pre-wrap">{m.body}</p></div>)}</section>)}
          {tab === "home" && (
            <section className="rounded-panel border border-line bg-white p-5"><h2 className="font-semibold text-navy-900">Une question administrative ?</h2>
              <p className="mt-1 text-ink-2">Service des admissions, du lundi au vendredi de 8:30 à 18:00.</p>
              <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" size="sm" onClick={() => toast({ tone: "warning", title: "Démo", text: "Aucun appel réel dans cette démonstration." })}><Phone size={14} />Appeler</Button>
                <Button variant="secondary" size="sm" onClick={() => toast({ tone: "warning", title: "Démo", text: "Aucun e-mail réel dans cette démonstration." })}><Mail size={14} />Écrire</Button></div></section>)}
          <p className="rounded-card bg-surface-2 p-3 text-meta text-ink-2">Pour toute question médicale, contactez directement votre chirurgien. En cas d'urgence, appelez le 15. N'indiquez aucune information médicale dans cet espace.</p>
        </>)}
      </main>
      <nav aria-label="Navigation" className="fixed bottom-0 left-1/2 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-4 border-t border-line bg-white pb-2 pt-1">
        {([["home", "Accueil", Home], ["tasks", "Tâches", ListChecks], ["journey", "Parcours", RouteIcon], ["messages", "Messages", MessageSquare]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} aria-current={tab === k} className={cn("flex flex-col items-center gap-0.5 py-2 text-meta font-medium", tab === k ? "text-teal-700" : "text-ink-2")}><I size={20} />{l}</button>))}
      </nav>
    </div>
  );
}
