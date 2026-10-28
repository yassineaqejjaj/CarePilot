import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ClipboardList, Home, ListChecks, Mail, MessageSquare, Phone, Route as RouteIcon, ShieldCheck } from "lucide-react";
import { ApiError, api, download } from "@/lib/api";
import { displayName, logout, patientSession } from "@/auth";
import type { Portal } from "@/lib/types";
import { Avatar, Button, ErrorState, Logo, Pill, Progress, Skeleton, useToast } from "@/components/ui";
import { useLang, taskTitle, type Lang } from "@/i18n";
import DocumentPreview from "@/components/DocumentPreview";
import PortalAdministration from "@/components/PortalAdministration";
import PatientAssistant from "@/components/PatientAssistant";
import { LiveUpdates, LiveBadge } from "@/lib/live";
import { cn } from "@/lib/utils";

type Tab = "home" | "tasks" | "journey" | "messages" | "rights";
const locale = (l: Lang) => (l === "ar" ? "ar-MA-u-nu-latn" : "fr-FR");  // chiffres latins : usage courant au Maroc
const long = (iso: string, l: Lang) => new Date(iso + "T12:00:00").toLocaleDateString(locale(l), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dm = (iso: string, l: Lang) => new Date(iso + "T12:00:00").toLocaleDateString(locale(l), { day: "numeric", month: "short" });

export default function PortalPage() {
  const qc = useQueryClient();
  const delegated=!!patientSession()?.delegated;
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingTask = useRef<string>("");
  const [preview,setPreview]=useState<{id:string;file:File}|null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const { data, error, refetch } = useQuery({ queryKey: ["me-portal"], queryFn: () => api<Portal>("/portal/me") });
  const [lang, setLang, t] = useLang(data?.language);
  const [kind, setKind] = useState<"rectification" | "opposition" | "deletion">("rectification");
  const [note, setNote] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["me-portal"] });
  const fail = (e: unknown) => toast({ tone: "critical", title: e instanceof ApiError && e.status === 415 ? t("err.type") : e instanceof ApiError && e.status === 413 ? t("err.size") : t("err.generic") });
  const consent = useMutation({ mutationFn: (accept: boolean) => api("/portal/consent", { method: "POST", body: JSON.stringify({ accept }) }), onSuccess: refresh, onError: () => toast({ tone: "warning", title: t("consent.refused") }) });
  const upload = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => { const f = new FormData(); f.append("file", file); return api(`/portal/tasks/${id}/upload`, { method: "POST", body: f }); },
    onSuccess: () => { refresh(); toast({ tone: "success", title: t("sent.title"), text: t("sent.text") }); }, onError: fail,
  });
  const submit = useMutation({
    mutationFn: (id: string) => api(`/portal/tasks/${id}/submit`, { method: "POST", body: JSON.stringify({ response: {} }) }),
    onSuccess: () => { refresh(); toast({ tone: "success", title: t("sent.title"), text: t("sent.text") }); }, onError: fail,
  });
  const rights = useMutation({
    mutationFn: () => api("/portal/rights", { method: "POST", body: JSON.stringify({ kind, message: note }) }),
    onSuccess: () => { setNote(""); toast({ tone: "success", title: t("rights.sent") }); }, onError: fail,
  });

  if (error) return <main className="mx-auto max-w-[430px] space-y-4 p-6"><Logo size={44}/>{error instanceof ApiError&&[401,410].includes(error.status)?<><h1 className="text-xl font-semibold">{lang==='ar'?'هذا الوصول لم يعد متاحاً.':'Cet accès n’est plus disponible.'}</h1><p className="text-ink-2">{lang==='ar'?'قد يكون الرابط أو الوصول منتهياً أو ملغى. اطلبوا رابطاً جديداً من المؤسسة أو المريض.':'Le lien ou l’accès a expiré ou a été révoqué. Demandez un nouveau lien à votre établissement ou au patient.'}</p></>:<ErrorState onRetry={refetch}/>}<Button size="patient" variant="secondary" onClick={()=>{sessionStorage.removeItem("cp_patient_session");location.href="/"}}>{lang==='ar'?'العودة إلى الموقع':'Retour au site'}</Button></main>;
  if (!data) return <div className="space-y-3 p-4"><Skeleton className="h-16" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;

  const header = (
    <header className="flex items-center gap-3 border-b border-line bg-white px-4 py-3">
      <Logo size={32} /><div className="flex-1 leading-tight"><p className="font-semibold text-navy-900">{data.establishment}</p><p className="text-meta text-ink-2">M3aya Santé</p></div>
      <button className="rounded-ctl border border-line-strong px-2.5 py-1 text-sm font-medium" onClick={() => setLang(lang === "fr" ? "ar" : "fr")}>{lang === "fr" ? "العربية" : "Français"}</button>
      <button aria-label={t("logout")} title={t("logout")} onClick={() => logout()}><Avatar name={displayName() || data.first_name} className="h-9 w-9" /></button>
    </header>
  );

  // ---- consentement préalable (loi 09-08, art. 4-5) : rien d'autre n'est affiché avant l'accord
  if (data.consent_required) {
    const n = data.notice;
    const rows: [string, string][] = [
      [t("consent.controller"), `${n.controller}${n.city && !n.controller.includes(n.city) ? ` · ${n.city}` : ""}`], [t("consent.purpose"), t("consent.purpose.v")], [t("consent.data"), t("consent.data.v")],
      [t("consent.recipients"), t("consent.recipients.v")], [t("consent.retention"), t("consent.retention.v", { days: n.retention_days })],
      [t("consent.rights"), t("consent.rights.v", { contact: n.rights_contact || "—" })], [t("consent.cndp"), n.cndp_ref || t("consent.cndp.none")],
    ];
    return (
      <div className="mx-auto min-h-screen max-w-[430px] bg-page text-patient">{header}
        <main className="space-y-4 px-4 py-5">
          <h1 className="flex items-center gap-2 text-[22px] font-semibold"><ShieldCheck className="text-teal-700" />{t("consent.title")}</h1>
          <p className="text-ink-2">{t("consent.intro")}</p>
          <dl className="divide-y divide-line rounded-panel border border-line bg-white">
            {rows.map(([k, v]) => <div key={k} className="p-4"><dt className="text-meta font-semibold uppercase tracking-wide text-teal-800">{k}</dt><dd className="mt-1">{v}</dd></div>)}
          </dl>
          <Button size="patient" disabled={consent.isPending} onClick={() => consent.mutate(true)}>{t("consent.accept")}</Button>
          <Button size="patient" variant="secondary" onClick={() => consent.mutate(false)}>{t("consent.refuse")}</Button>
        </main>
      </div>
    );
  }

  const j = data.journeys[0];
  const todo = j?.tasks.find((x) => x.status === "todo" && x.can_submit);
  const label = { todo: t("status.todo"), submitted: t("status.submitted"), done: t("status.done") } as const;
  const pick = (id: string) => { pendingTask.current = id; fileRef.current?.click(); };

  const Tasks = () => (
    <section aria-label={t("tasks.title")}><h2 className="mb-2 text-lg font-semibold">{t("tasks.title")}</h2>
      <ul className="overflow-hidden rounded-panel border border-line bg-white">
        {j?.tasks.map((x) => (
          <li key={x.id} className="flex items-center gap-3 border-b border-line p-4 last:border-0">
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", x.status === "done" ? "bg-success-bg text-success-text" : "bg-surface-2 text-ink-2")}>{x.status === "done" ? <Check size={15} /> : <ClipboardList size={15} />}</span>
            <div className="flex-1"><p className="font-semibold text-navy-900">{taskTitle(lang, x.title)}</p>
              {x.reason && <p className="mt-1 text-sm text-warning-text">{x.reason}</p>}
              <p className="text-meta text-ink-2">{x.status === "done" ? t("tasks.validated") : x.can_submit ? t("tasks.before", { date: dm(x.due_date, lang) }) : t("tasks.available", { date: dm(x.due_date, lang) })}</p></div>
            <Pill tone={x.status === "done" ? "success" : x.status === "submitted" ? "info" : x.can_submit ? "warning" : "neutral"}>{x.can_submit || x.status !== "todo" ? label[x.status] : t("status.soon")}</Pill>
          </li>))}
      </ul></section>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-[430px] flex-col bg-page">
      {header}
      <LiveUpdates />
      {preview&&<DocumentPreview file={preview.file} lang={lang} onCancel={()=>setPreview(null)} onConfirm={file=>{upload.mutate({id:preview.id,file});setPreview(null)}}/>}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/heic,application/pdf" capture="environment" className="hidden" aria-label="Fichier"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; const id = pendingTask.current || todo?.id; if (f && id) {if(!["image/jpeg","image/png","image/heic","image/heif","application/pdf"].includes(f.type)){toast({tone:"critical",title:t("err.type")});return;}setPreview({ id, file: f });} }} />
      <main className="flex-1 space-y-5 px-4 pb-24 pt-5 text-patient">
        <h1 className="text-[22px] font-semibold leading-snug">{t("greeting", { name: data.first_name })}</h1>
        <LiveBadge />
        {!j ? <p>—</p> : (<>
          {tab === "home" && (todo ? (
            <section className="rounded-panel bg-navy-900 p-5 text-white shadow-menu" aria-label={t("todo.before", { date: dm(todo.due_date, lang) })}>
              <p className="text-meta font-semibold uppercase tracking-wider text-signal">{t("todo.before", { date: dm(todo.due_date, lang) })}</p>
              <h2 className="mt-1 text-[20px] font-semibold text-white">{t(todo.kind === "document" ? "todo.deposit" : "todo.complete", { item: taskTitle(lang, todo.title) })}</h2>
              <p className="mt-1 text-white/80">{t("todo.help")}</p>
              {todo.kind === "document" ? (
                <Button size="patient" className="mt-4 bg-signal text-navy-900 hover:bg-mint-300" disabled={upload.isPending} onClick={() => pick(todo.id)}><Camera size={18} />{upload.isPending ? t("todo.sending") : t("todo.photo")}</Button>
              ) : (
                <Button size="patient" className="mt-4 bg-signal text-navy-900 hover:bg-mint-300" disabled={submit.isPending} onClick={() => submit.mutate(todo.id)}>{t("todo.done")}</Button>)}
            </section>) : (
            <section className="rounded-panel border border-line bg-white p-5"><p className="font-semibold text-navy-900">{t("alldone.title")}</p><p className="text-ink-2">{t("alldone.text")}</p></section>))}
          {(tab === "home" || tab === "journey") && (
            <section className="rounded-panel border border-line bg-white p-5" aria-label={t("prep.title")}>
              <div className="flex items-baseline justify-between"><h2 className="font-semibold text-navy-900">{t("prep.title")}</h2><span className="tabular-nums text-ink-2">{t("prep.steps", { done: j.progress.done, total: j.progress.total })}</span></div>
              <Progress value={j.progress.total ? (100 * j.progress.done) / j.progress.total : 0} className="mt-3 h-2" />
              <p className="mt-3 text-ink-2">{t("prep.surgery", { date: long(j.surgery_date, lang), time: j.admission_time })}</p>
              <p className="text-ink-2">{j.procedure}</p>
            </section>)}
          {(tab === "home" || tab === "tasks") && <Tasks />}
          {(tab === "home" || tab === "messages" || tab === "rights") && <PortalAdministration journeyId={j.journey_id} lang={lang} />}
          {(tab === "home" || tab === "journey") && (
            <section aria-label={t("dates.title")}><h2 className="mb-2 text-lg font-semibold">{t("dates.title")}</h2>
              {[[-1, t("dates.practical")], [0, t("dates.admission", { time: j.admission_time })]].map(([off, text]) => {
                const d = new Date(j.surgery_date + "T12:00:00"); d.setDate(d.getDate() + (off as number));
                return (<div key={String(off)} className="mb-2 flex gap-3 rounded-panel border border-line bg-white p-3">
                  <div className="w-12 shrink-0 rounded-ctl bg-mint-100 py-1 text-center text-teal-800"><p className="text-[10px] font-semibold uppercase">{d.toLocaleDateString(locale(lang), { month: "short" })}</p><p className="text-lg font-bold tabular-nums">{d.getDate()}</p></div>
                  <p className="flex-1 self-center">{text as string}</p></div>);
              })}</section>)}
          {tab === "messages" && !delegated && <PatientAssistant arabic={lang === "ar"} />}
          {tab === "messages" && (
            <section aria-label={t("messages.title")}><h2 className="mb-2 text-lg font-semibold">{t("messages.title")}</h2>
              {j.messages.length === 0 ? <p className="rounded-panel border border-line bg-white p-4 text-ink-2">{t("messages.none")}</p> :
                j.messages.map((m, i) => <div key={i} className="mb-2 rounded-panel border border-line bg-white p-4"><p className="font-semibold text-navy-900">{m.subject}</p><p className="mt-1 whitespace-pre-wrap">{m.body}</p></div>)}</section>)}
          {tab === "rights" && (
            <section aria-label={t("rights.title")} className="space-y-3"><h2 className="text-lg font-semibold">{t("rights.title")}</h2>
              <Button size="patient" variant="secondary" onClick={() => download("/portal/my-data", "mes-donnees.json").catch(fail)}>{t("rights.export")}</Button>
              <div className="space-y-2 rounded-panel border border-line bg-white p-4">
                <div className="grid gap-2">{(["rectification", "opposition", "deletion"] as const).map((k) => (
                  <label key={k} className={cn("flex items-center gap-2 rounded-ctl border p-3", kind === k ? "border-teal-700 bg-mint-100" : "border-line-strong")}>
                    <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />{t(`rights.${k}` as const)}</label>))}</div>
                <textarea aria-label={t("rights.message")} placeholder={t("rights.message")} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-24 w-full rounded-ctl border border-line-strong p-3" />
                <Button size="patient" disabled={rights.isPending} onClick={() => rights.mutate()}>{t("rights.send")}</Button>
              </div>
              <p className="text-meta text-ink-2">{data.notice.cndp_ref ? `CNDP : ${data.notice.cndp_ref}` : t("consent.cndp.none")} · {data.notice.rights_contact}</p>
            </section>)}
          {tab === "home" && (
            <section className="rounded-panel border border-line bg-white p-5"><h2 className="font-semibold text-navy-900">{t("help.title")}</h2>
              <p className="mt-1 text-ink-2">{t("help.hours")}</p>
              <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" size="sm" disabled={!data.contacts?.phone} onClick={() => { if(data.contacts?.phone)location.href="tel:"+data.contacts.phone; }}><Phone size={14} />{t("help.call")}</Button>
                <Button variant="secondary" size="sm" onClick={() => {setTab("messages");setTimeout(()=>{const help=document.getElementById("portal-help");help?.setAttribute("open","");help?.scrollIntoView({block:"center"});},0)}}><Mail size={14} />{t("help.write")}</Button></div></section>)}
          <p className="rounded-card bg-surface-2 p-3 text-meta text-ink-2">{t("disclaimer")}</p>
        </>)}
      </main>
      <nav aria-label="Navigation" className={cn("fixed bottom-0 left-1/2 grid w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-white pb-2 pt-1",delegated?"grid-cols-4":"grid-cols-5")}>
        {([["home", "tab.home", Home], ["tasks", "tab.tasks", ListChecks], ["journey", "tab.journey", RouteIcon], ["messages", "tab.messages", MessageSquare], ["rights", "tab.rights", ShieldCheck]] as const).filter(([k])=>!delegated||k!=="rights").map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} aria-current={tab === k} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", tab === k ? "text-teal-700" : "text-ink-2")}><I size={20} />{t(l)}</button>))}
      </nav>
    </div>
  );
}
