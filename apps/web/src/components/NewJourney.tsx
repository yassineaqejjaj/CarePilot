import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "@/lib/api";
import { Button, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

type ImportResult = { created: number; errors: { line: number; error: string }[]; dry_run: boolean };
const EMPTY = { first_name: "", last_name: "", birth_date: "", phone: "", email: "", language: "fr", preferred_channel: "whatsapp", procedure: "", surgeon: "", owner: "", surgery_date: "", admission_time: "08:00", template_id: "", informed: false };
const CSV_HELP = "first_name;last_name;birth_date;phone;surgery_date;procedure;surgeon;owner;language\nOmar;Tazi;02/05/1970;06 61 23 45 67;12/11/2026;Hernie inguinale;Dr A. Mansouri;Salma El Idrissi;fr";

const field = "mt-1 h-10 w-full rounded-ctl border border-line-strong bg-white px-3";

export default function NewJourney({ onClose, initialTemplateId }: { onClose: () => void; initialTemplateId?: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [f, setF] = useState({...EMPTY, template_id: initialTemplateId ?? ""});
  const templates = useQuery({queryKey:["templates"],queryFn:()=>api<{id:string;name:string;status:string;catalogue?:{anchor_label:string;anchor:string}|null}[]>("/templates")});
  const published = templates.data?.filter(t=>t.status === "published") ?? [];
  const chosen = published.find(t=>t.id===f.template_id);
  useEffect(()=>{
    if (!f.template_id && published.length) {
      const selected = published.find(t=>t.id===initialTemplateId) ?? published.find(t=>t.name.startsWith("Chirurgie ambulatoire")) ?? published[0];
      setF(prev=>({...prev,template_id:selected.id}));
    }
  },[templates.data, initialTemplateId, f.template_id]);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const refresh = () => ["cockpit", "journeys", "tasks"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const create = useMutation({
    mutationFn: () => api<{ id: string; reference: string }>("/journeys", { method: "POST", body: JSON.stringify({
      patient: { first_name: f.first_name, last_name: f.last_name, birth_date: f.birth_date, phone: f.phone, email: f.email, language: f.language, preferred_channel: f.preferred_channel, informed: f.informed },
      template_id: f.template_id || undefined, surgery_date: toIso(f.surgery_date), procedure: f.procedure, surgeon: f.surgeon, owner: f.owner, admission_time: f.admission_time }) }),
    onSuccess: (r) => { refresh(); toast({ tone: "success", title: "Parcours créé", text: r.reference }); onClose(); nav(`/parcours/${r.id}`); },
    onError: (e) => setErr(e instanceof ApiError ? e.detail : "Création impossible"),
  });
  const imp = useMutation({
    mutationFn: ({ dry }: { dry: boolean }) => { const d = new FormData(); d.append("file", file!); d.append("dry_run", String(dry)); return api<ImportResult>("/journeys/import", { method: "POST", body: d }); },
    onSuccess: (r) => { setResult(r); setErr(""); if (!r.dry_run) { refresh(); toast({ tone: "success", title: `${r.created} parcours importés`, text: r.errors.length ? `${r.errors.length} ligne(s) ignorée(s)` : undefined }); } },
    onError: (e) => setErr(e instanceof ApiError ? e.detail : "Import impossible"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4" role="dialog" aria-modal="true" aria-label="Nouveau parcours">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-panel bg-white p-6 shadow-modal">
        <div className="flex items-start justify-between"><h2 className="text-lg font-semibold">Nouveau parcours</h2><button aria-label="Fermer" onClick={onClose} className="text-ink-2">✕</button></div>
        <div className="mt-3 flex gap-2" role="tablist">
          {([["manual", "Saisie manuelle"], ["csv", "Import CSV"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setErr(""); }}
              className={cn("rounded-full border px-3 py-1 text-[13px] font-medium", tab === k ? "border-teal-700 bg-mint-100 text-teal-800" : "border-line-strong")}>{l}</button>))}
        </div>

        {tab === "manual" ? (
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setErr(""); create.mutate(); }}>
            <label className="md:col-span-2">Modèle de parcours<select required className={field} value={f.template_id} onChange={set("template_id")}><option value="">Choisir un modèle publié</option>{published.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            {templates.isError && <p className="text-critical-text md:col-span-2">Impossible de charger les modèles.</p>}
            {templates.isSuccess && !published.length && <p className="text-warning-text md:col-span-2">Publiez un modèle dans le catalogue ou le concepteur avant de créer un dossier.</p>}
            <label>Prénom<input required className={field} value={f.first_name} onChange={set("first_name")} /></label>
            <label>Nom<input required className={field} value={f.last_name} onChange={set("last_name")} /></label>
            <label>Date de naissance<input required className={field} placeholder="JJ/MM/AAAA" value={f.birth_date} onChange={set("birth_date")} /></label>
            <label>Téléphone (Maroc)<input className={field} placeholder="06 12 34 56 78" inputMode="tel" value={f.phone} onChange={set("phone")} /></label>
            <label>E-mail<input type="email" className={field} value={f.email} onChange={set("email")} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label>Langue<select className={field} value={f.language} onChange={set("language")}><option value="fr">Français</option><option value="ar">العربية</option></select></label>
              <label>Canal<select className={field} value={f.preferred_channel} onChange={set("preferred_channel")}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">E-mail</option></select></label>
            </div>
            <label>Acte / motif du rendez-vous<input required className={field} value={f.procedure} onChange={set("procedure")} /></label>
            <label>Praticien / service<input className={field} value={f.surgeon} onChange={set("surgeon")} /></label>
            <label>{chosen?.catalogue?.anchor_label ?? "Date d’intervention"}<input required className={field} placeholder="JJ/MM/AAAA" value={f.surgery_date} onChange={set("surgery_date")} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label>Heure d’accueil<input type="time" className={field} value={f.admission_time} onChange={set("admission_time")} /></label>
              <label>Responsable<input className={field} placeholder="Moi" value={f.owner} onChange={set("owner")} /></label>
            </div>
            <label className="flex items-start gap-2 md:col-span-2"><input type="checkbox" className="mt-1" checked={f.informed} onChange={(e) => setF({ ...f, informed: e.target.checked })} />
              <span>Le patient a été informé du traitement de ses données (finalité, destinataires, droits d'accès, de rectification et d'opposition — loi 09-08, art. 5).</span></label>
            {err && <p role="alert" className="rounded-ctl bg-critical-bg p-3 text-critical-text md:col-span-2">{err}</p>}
            <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button disabled={!f.informed || !f.template_id || create.isPending}>{create.isPending ? "Création…" : "Créer le parcours"}</Button></div>
          </form>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-ink-2">Colonnes : <code>first_name, last_name, surgery_date</code> (obligatoires), puis <code>birth_date, phone, email, procedure, surgeon, owner, language, channel, pathway</code>. Séparateur « ; » ou « , », dates JJ/MM/AAAA. 500 lignes maximum. La colonne pathway accepte la clé du catalogue (ex. imagerie, maternite) ; sans elle, le modèle ambulatoire publié reste le défaut.</p>
            <pre className="overflow-x-auto rounded-ctl bg-surface-2 p-3 text-meta">{CSV_HELP}</pre>
            <input type="file" accept=".csv,text/csv" aria-label="Fichier CSV" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setErr(""); }} />
            {err && <p role="alert" className="rounded-ctl bg-critical-bg p-3 text-critical-text">{err}</p>}
            {result && (
              <div className="rounded-ctl border border-line p-3" aria-live="polite">
                <p className="font-semibold">{result.dry_run ? "Simulation" : "Import terminé"} : {result.created} parcours {result.dry_run ? "seraient créés" : "créés"}, {result.errors.length} ligne(s) en erreur.</p>
                <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-5 text-critical-text">{result.errors.map((x) => <li key={x.line}>Ligne {x.line} : {x.error}</li>)}</ul>
              </div>)}
            <p className="text-meta text-ink-2">En important, vous confirmez que les patients ont été informés du traitement de leurs données (loi 09-08, art. 5).</p>
            <div className="flex justify-end gap-2"><Button variant="secondary" disabled={!file || imp.isPending} onClick={() => imp.mutate({ dry: true })}>Simuler</Button>
              <Button disabled={!file || imp.isPending} onClick={() => imp.mutate({ dry: false })}>Importer</Button></div>
          </div>)}
      </div>
    </div>
  );
}

/** JJ/MM/AAAA ou AAAA-MM-JJ -> AAAA-MM-JJ (le serveur valide). */
function toIso(v: string): string {
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v.trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : v.trim();
}
