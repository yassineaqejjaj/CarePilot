import { useDisplay, technicalExample } from "@/lib/display";
import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  Clock3,
  FileCheck2,
  Plug,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import ValidationPage from "@/pages/Validation";
import { roles, subject } from "@/auth";
import {
  Button,
  Card,
  ErrorState,
  Pill,
  Skeleton,
  useToast,
} from "@/components/ui";
const input =
  "mt-1 block w-full rounded-ctl border border-line-strong bg-white p-2 text-sm";
const money = (n: number) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(
    n / 100,
  );
const states: Record<string, string> = {
  preparing: "En préparation",
  ready: "Complet administrativement",
  arrived: "Accueil effectué",
  closed: "Clôturé",
  draft: "À préparer",
  submitted: "Transmis",
  more_info: "Complément demandé",
  approved: "Accord reçu",
  rejected: "Refus reçu",
  simulated: "Simulation",
  sent: "Accepté par le fournisseur",
  delivered: "Livré",
  failed: "Échec",
  sending: "En cours / à vérifier",
  manual: "Contact manuel déclaré",
  inbound: "Réponse du patient",
  inbound_read: "Réponse traitée par l’équipe",
};
const activityLabels: Record<string, string> = {
  document_check: "Vérification de document",
  admission: "Admission administrative",
  insurance: "Suivi assurance",
  reminder: "Relance",
  phone_call: "Appel téléphonique",
};
const entryLabels: Record<string, string> = {
  quote: "Devis",
  coverage: "Couverture",
  deposit: "Acompte",
  refund: "Remboursement",
  void: "Annulation",
};
const eventLabels: Record<string, string> = {
  note: "Note interne",
  handoff: "Transmission du dossier",
  insurance: "Suivi de prise en charge",
  finance: "Suivi financier",
  message: "Communication",
  manual_contact: "Contact manuel",
  patient_message: "Réponse du patient",
  profile_requested: "Coordonnées à vérifier",
  profile_confirmed: "Coordonnées confirmées",
  profile_validated: "Vérification des coordonnées",
  reschedule: "Date déplacée",
  reply_read: "Réponse traitée",
};
const detailLabels: Record<string, string> = {
  department: "Service",
  owner: "Responsable",
  phase: "Étape administrative",
  exception: "Situation particulière",
  status: "État",
  kind: "Type",
  amount_cents: "Montant (centimes MAD)",
  id: "Référence",
  void: "Écriture annulée",
  from: "Date précédente",
  to: "Nouvelle date",
  reason: "Motif",
  phone: "Téléphone",
  email: "E-mail",
  language: "Langue",
  preferred_channel: "Canal souhaité",
  request: "Demande",
  message: "Message",
};
const describe = (v: unknown): string =>
  typeof v === "string"
    ? v
    : v && typeof v === "object"
      ? Object.entries(v)
          .map(
            ([k, x]) =>
              (detailLabels[k] ?? k) +
              " : " +
              ((states[String(x)] ?? entryLabels[String(x)] ?? String(x)) ||
                "—"),
          )
          .join("\n")
      : String(v ?? "");
type Row = {
  id: string;
  reference: string;
  patient: string;
  date: string;
  owner: string;
  department: string;
  phase: string;
  exception: string;
  next_action: string;
  due_date: string | null;
  submitted: number;
  missing: number;
  insurance_pending: number;
  assigned_subject: string;
  owner_available: boolean;
  status: string;
  help_pending: number;
  profile_pending: number;
  unread: number;
};
type Member = {
  id: string | null;
  subject: string;
  display_name: string;
  role: string;
  department: string;
  active: boolean;
  available: boolean;
  backup_subject: string;
};
type Ledger = {
  quote: number;
  coverage: number;
  deposit: number;
  refund: number;
  estimated_patient_share: number;
  balance: number;
  notice: string;
  entries: {
    id: string;
    kind: string;
    amount_cents: number;
    reference: string;
    voided: boolean;
  }[];
};
type Dossier = {
  id: string;
  reference: string;
  revision: number;
  assigned_subject: string;
  department: string;
  phase: string;
  exception: string;
  finance: Ledger;
  insurance: {
    id: string;
    insurer: string;
    reference: string;
    status: string;
    revision: number;
    note: string;
    due_date: string | null;
  }[];
  events: { id: string; kind: string; text: unknown; created_at: string }[];
  support: { id: string; status: string; message: string }[];
  preparation: { missing: number; submitted: number };
  patient: { name: string; phone: string; email: string };
};
type Metrics = {
  active: number;
  ready: number;
  ready_pct: number;
  reminders: number;
  messages: Record<string, number>;
  insurance_response_hours: number | null;
  insurance_sample: number;
  adoption: number;
  observations: {
    activity: string;
    baseline_n: number;
    pilot_n: number;
    baseline_seconds: number | null;
    pilot_seconds: number | null;
    observed_difference_seconds: number | null;
  }[];
  definition: string;
};
const dayKey = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const showDate = (date: string | null) =>
  date
    ? new Date(date + "T12:00:00").toLocaleDateString("fr-FR")
    : "Sans échéance";
function rowAction(r: Row) {
  if (r.help_pending)
    return { label: "Répondre à la demande", section: "aide" };
  if (r.profile_pending)
    return { label: "Vérifier les coordonnées", section: "historique" };
  if (r.unread) return { label: "Lire la réponse", section: "communications" };
  if (r.submitted)
    return { label: "Vérifier les pièces", section: "documents" };
  if (r.insurance_pending)
    return { label: "Suivre l’assurance", section: "assurance" };
  return {
    label: r.missing ? "Voir les pièces manquantes" : "Examiner le dossier",
    section: r.missing ? "documents" : "coordination",
  };
}
type SavedView = {
  category?: string;
  personal: boolean;
  actions: boolean;
  window: "all" | "tomorrow" | "today";
  sort: "due" | "patient" | "owner";
};
const fd = (f: HTMLFormElement) => Object.fromEntries(new FormData(f));
export default function Operations({ mode }: { mode?: string }) {
  const { hideTechnical } = useDisplay();
  const navigate = useNavigate();
  const qc = useQueryClient(),
    toast = useToast();
  const [params, setParams] = useSearchParams();
  const selected = params.get("dossier");
  const closeDossier = () =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("dossier");
      next.delete("section");
      return next;
    });
  const tabs: Record<string, string> = {
    equipe: "Équipe",
    reseau: "Réseau",
    mesures: "Mesures",
    integrations: "Intégrations",
    demarrage: "Démarrage",
    documents: "Documents à vérifier",
    assurances: "Assurances",
    reponses: "Réponses patients",
    aide: "Demandes d’aide",
    validations: "Validations en attente",
  };
  const tab = mode ?? tabs[params.get("onglet") ?? ""] ?? "Dossiers";
  const [personal, setPersonal] = useState(
    !roles().includes("admin") && roles().includes("coordinator"),
  );
  const [showFilters, setShowFilters] = useState(false);
  const [selectedView, setSelectedView] = useState("");
  const [dateWindow, setDateWindow] = useState<SavedView["window"]>("all");
  const [sort, setSort] = useState<SavedView["sort"]>("due");
  const viewKey =
    "m3aya-views:" +
    subject() +
    ":" +
    (sessionStorage.getItem("m3aya_site") ?? "primary");
  const [saved, setSaved] = useState<SavedView[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(viewKey) ?? "[]")
        .filter(
          (x: SavedView) =>
            ["all", "tomorrow", "today"].includes(x.window) &&
            ["due", "patient", "owner"].includes(x.sort) &&
            (!x.category ||
              ["documents", "assurances", "reponses", "aide"].includes(
                x.category,
              )),
        )
        .slice(0, 5);
    } catch {
      return [];
    }
  });
  function saveView() {
    const next = [
      ...saved,
      {
        personal,
        actions: mine,
        window: dateWindow,
        sort,
        category: ["documents", "assurances", "reponses", "aide"].includes(
          params.get("onglet") ?? "",
        )
          ? params.get("onglet")!
          : "",
      },
    ].slice(-5);
    try {
      localStorage.setItem(viewKey, JSON.stringify(next));
      setSaved(next);
      setSelectedView("saved-" + (next.length - 1));
      toast({
        tone: "success",
        title: "Vue enregistrée",
        text: "La recherche nominative n’est pas mémorisée.",
      });
    } catch {
      toast({ tone: "warning", title: "Stockage local indisponible" });
    }
  }
  function resetFilters() {
    setSelectedView("");
    setSearch("");
    setMine(false);
    setPersonal(false);
    setDateWindow("all");
    setSort("due");
    setParams({});
  }
  function applyView(value: string) {
    setSelectedView(value);
    if (value.startsWith("saved-")) {
      const v = saved[Number(value.slice(6))];
      if (v) {
        setPersonal(v.personal);
        setMine(v.actions);
        setDateWindow(v.window);
        setSort(v.sort);
        setParams(v.category ? { onglet: v.category } : {});
      }
    } else {
      setSort("due");
      setPersonal(value === "mine");
      setMine(value !== "all");
      setDateWindow(value === "tomorrow" ? "tomorrow" : "all");
      setParams(value === "insurance" ? { onglet: "assurances" } : {});
    }
    setSearch("");
  }
  const [search, setSearch] = useState(""),
    [mine, setMine] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [secret, setSecret] = useState("");
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="Dossier administratif"]',
    );
    root?.querySelector<HTMLElement>("button")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDossier();
        return;
      }
      if (e.key === "Tab" && root) {
        const elements = Array.from(
          root.querySelectorAll<HTMLElement>(
            "button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
          ),
        );
        const visible = elements.filter((el) => el.getClientRects().length > 0);
        const first = visible[0],
          last = visible[visible.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [selected]);
  const admin = roles().includes("admin"),
    write = admin || roles().includes("coordinator");
  const q = useQuery({
    queryKey: ["operations-worklist"],
    queryFn: () =>
      api<{ items: Row[]; scope: string; messaging_provider: string }>(
        "/operations/worklist",
      ),
  });
  const team = useQuery({
    queryKey: ["operations-team"],
    queryFn: () => api<{ items: Member[]; notice: string }>("/operations/team"),
  });
  const detail = useQuery({
    queryKey: ["operations-case", selected],
    queryFn: () => api<Dossier>("/operations/cases/" + selected),
    enabled: !!selected,
  });
  const messages = useQuery({
    queryKey: ["operations-messages", selected],
    queryFn: () =>
      api<{ items: { id: string; status: string; body: string }[] }>(
        "/operations/cases/" + selected + "/messages",
      ),
    enabled: !!selected,
  });
  const metrics = useQuery({
    queryKey: ["operations-metrics"],
    queryFn: () => api<Metrics>("/operations/metrics"),
    enabled: tab === "Mesures",
  });
  const connections = useQuery({
    queryKey: ["operations-connections"],
    queryFn: () =>
      api<{ items: { id: string; name: string; active: boolean }[] }>(
        "/operations/connections",
      ),
    enabled: admin && tab === "Intégrations",
  });
  const setup = useQuery({
    queryKey: ["operations-setup"],
    queryFn: () =>
      api<{
        preferences: {
          support_phone: string;
          support_email: string;
          contact_start_hour: number;
          contact_end_hour: number;
        };
        checklist: { label: string; done: boolean }[];
        notice: string;
      }>("/operations/setup"),
    enabled: tab === "Démarrage",
  });
  const sites = useQuery({
    queryKey: ["operations-sites"],
    queryFn: () =>
      api<{
        current: string;
        items: { id: string; name: string; metrics: Metrics }[];
        notice: string;
      }>("/operations/sites"),
    enabled: tab === "Réseau",
  });
  async function perform(path: string, body: unknown = {}, method = "POST") {
    setBusy(true);
    setError("");
    try {
      const r = await api<Record<string, unknown>>(path, {
        method,
        body: method === "DELETE" ? undefined : JSON.stringify(body),
      });
      await qc.invalidateQueries({
        predicate: (q) =>
          ["operations", "cockpit", "journey", "tasks", "me"].some((k) =>
            String(q.queryKey[0]).startsWith(k),
          ),
      });
      toast({ tone: "success", title: "Modification enregistrée" });
      return r;
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Action impossible");
      return null;
    } finally {
      setBusy(false);
    }
  }
  const scoped = (q.data?.items ?? []).filter(
    (r) =>
      (!personal || !r.assigned_subject || r.assigned_subject === subject()) &&
      (!hideTechnical || !technicalExample(r.patient)),
  );
  const visibleItems = q.data ? scoped : undefined;
  const rows = scoped.filter(
    (r) =>
      (r.patient + " " + r.reference + " " + r.owner)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (dateWindow === "all" ||
        (dateWindow === "tomorrow"
          ? r.date === dayKey(1)
          : !!r.due_date && r.due_date <= dayKey())) &&
      (!mine ||
        r.submitted > 0 ||
        r.insurance_pending > 0 ||
        r.help_pending > 0 ||
        r.profile_pending > 0 ||
        r.unread > 0) &&
      (tab !== "Assurances" || r.insurance_pending > 0) &&
      (tab !== "Documents à vérifier" || r.submitted > 0) &&
      (tab !== "Réponses patients" || r.unread > 0) &&
      (tab !== "Demandes d’aide" ||
        r.help_pending > 0 ||
        r.profile_pending > 0),
  );
  rows.sort((a, b) =>
    sort === "patient"
      ? a.patient.localeCompare(b.patient, "fr")
      : sort === "owner"
        ? a.owner.localeCompare(b.owner, "fr")
        : (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
          a.patient.localeCompare(b.patient, "fr"),
  );
  const openRow = (r: Row) => {
    const action = rowAction(r);
    if (action.section === "documents")
      navigate(`/parcours/${r.id}?onglet=documents`);
    else
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set("dossier", r.id);
        next.set("section", action.section);
        return next;
      });
  };
  const activeFilters =
    !!search || mine || personal || dateWindow !== "all" || sort !== "due";
  const d = detail.data;
  const section = [
    "assurance",
    "finances",
    "communications",
    "historique",
    "coordination",
    "aide",
  ].includes(params.get("section") ?? "")
    ? params.get("section")!
    : "coordination";
  useEffect(() => {
    if (d && section) {
      const target = document.getElementById("case-" + section);
      target?.scrollIntoView({ block: "start", behavior: "instant" });
      target?.focus({ preventScroll: true });
    }
  }, [d?.id, section]);
  return (
    <div className="space-y-5">
      <div>
        <Pill tone="mint">Coordination administrative</Pill>
        <h1 className="mt-2 text-2xl font-semibold">
          {mode === "Mesures"
            ? "Résultats du pilote"
            : mode === "Équipe"
              ? "Équipe & accès"
              : (mode ?? "À traiter")}
        </h1>
        <p className="mt-2 text-ink-2">
          Les démarches administratives, leurs responsables et leurs échéances,
          sans décision médicale.
        </p>
      </div>
      <div
        className="flex gap-2 overflow-x-auto whitespace-nowrap pb-2 md:flex-wrap"
        role="tablist"
        aria-label={mode ?? "À traiter"}
      >
        {(mode
          ? [mode]
          : [
              "Dossiers",
              "Documents à vérifier",
              "Assurances",
              "Réponses patients",
              "Demandes d’aide",
              "Validations en attente",
            ]
        ).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={
              "rounded-full border px-4 py-2 " +
              (tab === t
                ? "border-teal-700 bg-mint-100 text-teal-800"
                : "border-line")
            }
            onClick={() => {
              setError("");
              setParams(
                t === "Dossiers"
                  ? {}
                  : { onglet: Object.keys(tabs).find((k) => tabs[k] === t)! },
              );
            }}
          >
            {t === "Assurances" ? "Assurances à suivre" : t}
            {q.data &&
              [
                "Documents à vérifier",
                "Assurances",
                "Réponses patients",
                "Demandes d’aide",
              ].includes(t) && (
                <span className="ml-2 rounded-full bg-surface-2 px-2 text-meta">
                  {
                    scoped.filter((r) =>
                      t === "Documents à vérifier"
                        ? r.submitted > 0
                        : t === "Assurances"
                          ? r.insurance_pending > 0
                          : t === "Réponses patients"
                            ? r.unread > 0
                            : r.help_pending > 0 || r.profile_pending > 0,
                    ).length
                  }{" "}
                  dossiers
                </span>
              )}
          </button>
        ))}
      </div>
      {!mode && (
        <Link to="/taches" className="inline-block text-teal-700 underline">
          Consulter toutes les tâches et échéances
        </Link>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-card bg-critical-bg p-4 text-critical-text"
        >
          {error}
        </p>
      )}
      {tab === "Validations en attente" && <ValidationPage />}
      {mode === "Mesures" && (
        <Link className="inline-block text-teal-700 underline" to="/analyses">
          Voir les statistiques d’activité et les estimations
        </Link>
      )}
      {!mode && (
        <details className="text-meta text-ink-2">
          <summary className="cursor-pointer py-2">
            Comprendre les compteurs
          </summary>
          <p className="mt-2">
            Chaque onglet compte des dossiers distincts : un dossier peut
            apparaître dans plusieurs onglets. Les cartes comptent les pièces ou
            demandes. Les compteurs suivent le périmètre personnel ; la
            recherche et la période filtrent la liste.
          </p>
        </details>
      )}
      {[
        "Dossiers",
        "Documents à vérifier",
        "Assurances",
        "Réponses patients",
        "Demandes d’aide",
      ].includes(tab) && (
        <>
          <div className="hidden gap-3 md:grid md:grid-cols-3">
            {[
              [
                "Documents à vérifier",
                visibleItems?.reduce((n, r) => n + r.submitted, 0),
              ],
              [
                "Demandes d’assurance à suivre",
                visibleItems?.reduce((n, r) => n + r.insurance_pending, 0),
              ],
              [
                "Dossiers sans pièce bloquante",
                visibleItems?.filter((r) => r.missing === 0).length,
              ],
            ].map(([l, v]) => (
              <Card key={String(l)} className="p-4">
                <p className="text-ink-2">{l}</p>
                <p className="mt-2 text-3xl font-semibold">{v ?? "—"}</p>
              </Card>
            ))}
          </div>
          <Button
            variant="secondary"
            className="w-full md:hidden"
            aria-expanded={showFilters}
            aria-controls="worklist-filters"
            onClick={() => setShowFilters(!showFilters)}
          >
            Rechercher et filtrer{activeFilters ? " · filtres actifs" : ""}
          </Button>
          <div
            id="worklist-filters"
            className={showFilters ? "space-y-3" : "hidden space-y-3 md:block"}
          >
            <div className="flex flex-wrap items-end gap-3 rounded-card border border-line p-3">
              <label className="min-w-40">
                Vues de travail
                <select
                  aria-label="Vues de travail"
                  className={input}
                  value={selectedView}
                  onChange={(e) => applyView(e.target.value)}
                >
                  <option value="" disabled>
                    Choisir une vue
                  </option>
                  <option value="all">Tout l’établissement</option>
                  <option value="mine">Mes dossiers à traiter</option>
                  <option value="tomorrow">Prises en charge demain</option>
                  <option value="insurance">Assurances en attente</option>
                  {saved.map((v, i) => (
                    <option key={i} value={"saved-" + i}>
                      {`Vue ${i + 1} · ${v.category ? tabs[v.category] : v.personal ? "Mes dossiers" : "Établissement"}${v.window === "tomorrow" ? " · Demain" : v.window === "today" ? " · À échéance" : ""}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Période
                <select
                  aria-label="Période de la liste"
                  className={input}
                  value={dateWindow}
                  onChange={(e) => {
                    setSelectedView("");
                    setDateWindow(e.target.value as SavedView["window"]);
                  }}
                >
                  <option value="all">Toutes les dates</option>
                  <option value="today">
                    Échéance au plus tard aujourd’hui
                  </option>
                  <option value="tomorrow">Prise en charge demain</option>
                </select>
              </label>
              <label>
                Trier par
                <select
                  aria-label="Trier la liste"
                  className={input}
                  value={sort}
                  onChange={(e) => {
                    setSelectedView("");
                    setSort(e.target.value as SavedView["sort"]);
                  }}
                >
                  <option value="due">Échéance la plus proche</option>
                  <option value="patient">Nom du patient</option>
                  <option value="owner">Responsable</option>
                </select>
              </label>
              <Button variant="secondary" onClick={saveView}>
                Enregistrer cette vue
              </Button>
              {saved.length > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    try {
                      localStorage.removeItem(viewKey);
                    } catch {}
                    setSaved([]);
                    setSelectedView("");
                  }}
                >
                  Effacer mes vues
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex-1">
                Rechercher un dossier
                <input
                  className={input}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom, référence, responsable"
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mine}
                  onChange={(e) => {
                    setSelectedView("");
                    setMine(e.target.checked);
                  }}
                />
                À traiter par l’équipe
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={personal}
                  onChange={(e) => {
                    setSelectedView("");
                    setPersonal(e.target.checked);
                  }}
                />
                Mes dossiers et ceux sans responsable
              </label>
            </div>
          </div>
          {activeFilters && (
            <div
              className="flex flex-wrap items-center gap-2 text-meta"
              aria-label="Filtres actifs"
            >
              <span className="font-semibold">Filtres actifs :</span>
              {search && <Pill>Recherche</Pill>}
              {personal && <Pill>Mes dossiers / sans responsable</Pill>}
              {mine && <Pill>Actions en attente</Pill>}
              {dateWindow !== "all" && (
                <Pill>
                  {dateWindow === "tomorrow"
                    ? "Prise en charge demain"
                    : "Échéance au plus tard aujourd’hui"}
                </Pill>
              )}
              {sort !== "due" && (
                <Pill>
                  Tri : {sort === "patient" ? "patient" : "responsable"}
                </Pill>
              )}
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                Effacer les filtres
              </Button>
            </div>
          )}
          <p role="status" className="text-meta text-ink-2">
            {q.data
              ? `${rows.length} dossier(s) affiché(s) sur ${scoped.length} dans ce périmètre`
              : "Chargement des dossiers…"}
          </p>
          {q.isError ? (
            <ErrorState onRetry={q.refetch} />
          ) : !q.data ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <div
                className="space-y-3 md:hidden"
                aria-label="Dossiers à traiter sur mobile"
              >
                {rows.map((r) => (
                  <Card key={r.id} className="p-4">
                    <p className="font-semibold text-base">{r.patient}</p>
                    <p className="mt-1 text-meta text-ink-2">
                      {r.reference} · {r.owner || "À affecter"}
                    </p>
                    <p className="mt-3">
                      {r.next_action === "Création du parcours"
                        ? "Pièces administratives à recueillir"
                        : r.next_action}
                    </p>
                    <p className="mt-2 text-meta">
                      Échéance : {showDate(r.due_date)}
                    </p>
                    <p className="text-meta text-ink-2">
                      {r.missing} pièce(s) bloquante(s) · {r.submitted} reçue(s)
                    </p>
                    <Button
                      className="mt-3 min-h-11 w-full"
                      onClick={() => openRow(r)}
                    >
                      {rowAction(r).label}
                    </Button>
                  </Card>
                ))}
                {!rows.length && <p>Aucun dossier pour ces filtres.</p>}
              </div>
              <Card className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[680px] text-left">
                  <thead className="bg-surface-2 text-meta text-ink-2">
                    <tr>
                      {[
                        "Dossier",
                        "Prochaine action",
                        "Responsable",
                        "Échéance",
                        "",
                      ].map((x) => (
                        <th className="p-3" key={x}>
                          {x}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-line">
                        <td className="p-3">
                          <strong>{r.patient}</strong>
                          <p className="text-meta text-ink-2">
                            {r.reference} · {states[r.phase]}
                          </p>
                          {r.exception && (
                            <Pill tone="warning">Situation à accompagner</Pill>
                          )}
                        </td>
                        <td className="p-3">
                          <p>
                            {r.next_action === "Création du parcours"
                              ? r.missing
                                ? "Recueillir les pièces administratives"
                                : "Vérifier les tâches restantes"
                              : r.next_action}
                          </p>
                          <p className="text-meta text-ink-2">
                            {r.missing} pièce(s) bloquante(s) · {r.submitted}{" "}
                            reçue(s)
                          </p>
                        </td>
                        <td className="p-3">
                          {r.owner || "À affecter"}
                          <p className="text-meta text-ink-2">
                            {r.department}
                            {!r.owner_available ? " · absent, réaffecter" : ""}
                          </p>
                        </td>
                        <td className="p-3">
                          {showDate(r.due_date)}
                          {r.due_date && (
                            <p
                              className={
                                r.due_date < dayKey()
                                  ? "mt-1 text-meta font-semibold text-critical-text"
                                  : "mt-1 text-meta text-ink-2"
                              }
                            >
                              {r.due_date < dayKey()
                                ? "Échéance dépassée"
                                : r.due_date === dayKey()
                                  ? "À traiter aujourd’hui"
                                  : "À venir"}
                            </p>
                          )}
                          <span className="text-meta text-ink-2">
                            Échéance administrative
                          </span>
                        </td>
                        <td className="p-3">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openRow(r)}
                          >
                            {rowAction(r).label}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!rows.length && (
                  <p className="p-5 text-ink-2">
                    Aucun dossier à afficher avec ces filtres.
                  </p>
                )}
              </Card>
            </>
          )}
          <p className="text-meta text-ink-2">{q.data?.scope}</p>
        </>
      )}
      {tab === "Équipe" && (
        <>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users size={20} />
              Équipes et remplacements
            </h2>
            <p className="mt-2 text-ink-2">{team.data?.notice}</p>
            <div className="mt-4 space-y-3">
              {team.data?.items.map((m) => (
                <div
                  className="flex flex-wrap items-center gap-3 rounded-card border border-line p-3"
                  key={m.subject}
                >
                  <div className="flex-1">
                    <strong>{m.display_name}</strong>
                    <p className="text-meta text-ink-2">
                      {m.department} · {m.role} ·{" "}
                      {m.available ? "Disponible" : "Absent"} ·{" "}
                      {m.active ? "Accès actif" : "Suspendu"}
                    </p>
                    {admin && (
                      <details className="mt-1 text-meta text-ink-2">
                        <summary>Référence du compte</summary>
                        <code>{m.subject}</code>
                      </details>
                    )}
                  </div>
                  {admin && m.id && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          perform(
                            "/operations/team",
                            { ...m, id: undefined, available: !m.available },
                            "PUT",
                          )
                        }
                      >
                        {m.available
                          ? "Déclarer absent"
                          : "Déclarer disponible"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          perform(
                            "/operations/team",
                            { ...m, id: undefined, active: !m.active },
                            "PUT",
                          )
                        }
                      >
                        {m.active ? "Suspendre" : "Réactiver"}
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
          {admin && (
            <Card className="p-5">
              <h3 className="font-semibold">
                Rattacher un compte Keycloak existant
              </h3>
              <form
                className="mt-4 grid gap-3 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.currentTarget;
                  const values = fd(f);
                  await perform(
                    "/operations/team",
                    { ...values, active: true, available: true },
                    "PUT",
                  );
                }}
              >
                <label>
                  Référence du compte existant
                  <input
                    className={input}
                    name="subject"
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  Nom affiché
                  <input
                    className={input}
                    name="display_name"
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Service
                  <input
                    className={input}
                    name="department"
                    defaultValue="Admissions"
                    required
                  />
                </label>
                <label>
                  Rôle
                  <select className={input} name="role">
                    <option value="coordinator">Coordination</option>
                    <option value="viewer">Consultation seule</option>
                    <option value="designer">Concepteur</option>
                    <option value="admin">Administration</option>
                  </select>
                </label>
                <label>
                  Remplaçant
                  <select className={input} name="backup_subject">
                    <option value="">Aucun</option>
                    {team.data?.items
                      .filter((x) => x.id && x.active)
                      .map((x) => (
                        <option key={x.subject} value={x.subject}>
                          {x.display_name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <Button disabled={busy}>Enregistrer le rattachement</Button>
                </div>
              </form>
              <p className="mt-3 text-meta text-ink-2">
                Le rôle ne peut pas dépasser les droits accordés dans Keycloak.
                Aucun mot de passe n’est créé ou affiché ici.
              </p>
            </Card>
          )}
        </>
      )}
      {tab === "Démarrage" && (
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Préparer le premier pilote</h2>
          <p className="text-ink-2">{setup.data?.notice}</p>
          <ul className="space-y-3">
            {setup.data?.checklist.map((c) => (
              <li className="flex items-center gap-3" key={c.label}>
                <Pill tone={c.done ? "success" : "warning"}>
                  {c.done ? "Prêt" : "À préparer"}
                </Pill>
                {c.label}
              </li>
            ))}
          </ul>
          {write && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => perform("/operations/team/register-self")}
            >
              Rattacher mon compte à l’équipe
            </Button>
          )}
          {admin && setup.data && (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const b = fd(e.currentTarget);
                perform(
                  "/operations/setup",
                  {
                    ...b,
                    contact_start_hour: Number(b.contact_start_hour),
                    contact_end_hour: Number(b.contact_end_hour),
                  },
                  "PUT",
                );
              }}
            >
              <label>
                Téléphone des admissions
                <input
                  className={input}
                  name="support_phone"
                  type="tel"
                  defaultValue={setup.data.preferences.support_phone}
                />
              </label>
              <label>
                E-mail des admissions
                <input
                  className={input}
                  name="support_email"
                  type="email"
                  defaultValue={setup.data.preferences.support_email}
                />
              </label>
              <label>
                Envoi autorisé à partir de (heure Maroc)
                <input
                  className={input}
                  type="number"
                  name="contact_start_hour"
                  min="0"
                  max="23"
                  defaultValue={setup.data.preferences.contact_start_hour}
                />
              </label>
              <label>
                Fin de la plage d’envoi (heure Maroc)
                <input
                  className={input}
                  type="number"
                  name="contact_end_hour"
                  min="1"
                  max="24"
                  defaultValue={setup.data.preferences.contact_end_hour}
                />
              </label>
              <Button disabled={busy}>
                Enregistrer les contacts et horaires
              </Button>
            </form>
          )}
        </Card>
      )}
      {tab === "Mesures" && (
        <>
          {metrics.data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Complétude administrative", metrics.data.ready_pct + " %"],
                  ["Utilisateurs actifs sur 7 jours", metrics.data.adoption],
                  [
                    "Délai observé assurance",
                    metrics.data.insurance_response_hours === null
                      ? "Pas de données"
                      : metrics.data.insurance_response_hours.toFixed(1) + " h",
                  ],
                ].map(([l, v]) => (
                  <Card className="p-5" key={l}>
                    <p className="text-ink-2">{l}</p>
                    <strong className="text-2xl">{v}</strong>
                  </Card>
                ))}
              </div>
              <Card className="p-5">
                <h2 className="font-semibold">
                  Mesurer avant et après le pilote
                </h2>
                <p className="mt-2 text-ink-2">{metrics.data.definition}</p>
                <div className="mt-4 space-y-2">
                  {metrics.data.observations.map((r) => (
                    <p key={r.activity}>
                      {activityLabels[r.activity] ?? r.activity} : avant{" "}
                      {r.baseline_n} observation(s), pilote {r.pilot_n} · écart
                      observé{" "}
                      {r.observed_difference_seconds === null
                        ? "non calculable"
                        : Math.round(r.observed_difference_seconds) + " s"}
                    </p>
                  ))}
                  {!metrics.data.observations.length && (
                    <p>Aucune observation saisie. Aucun gain n’est inventé.</p>
                  )}
                </div>
                {write && (
                  <form
                    className="mt-4 grid gap-3 sm:grid-cols-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const b = fd(e.currentTarget);
                      perform("/operations/observations", {
                        ...b,
                        seconds: Number(b.seconds),
                      });
                    }}
                  >
                    <label>
                      Période
                      <select className={input} name="cohort">
                        <option value="baseline">Avant pilote</option>
                        <option value="pilot">Pendant pilote</option>
                      </select>
                    </label>
                    <label>
                      Activité
                      <select className={input} name="activity">
                        {[
                          "document_check",
                          "admission",
                          "insurance",
                          "reminder",
                          "phone_call",
                        ].map((x) => (
                          <option key={x} value={x}>
                            {activityLabels[x] ?? x}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Durée observée (secondes)
                      <input
                        className={input}
                        name="seconds"
                        type="number"
                        min="1"
                        max="86400"
                        required
                      />
                    </label>
                    <div className="flex items-end">
                      <Button disabled={busy}>Ajouter la mesure</Button>
                    </div>
                  </form>
                )}
              </Card>
              <Card className="p-5">
                <h3 className="font-semibold">Livraison des communications</h3>
                <div className="mt-3 flex flex-wrap gap-3">
                  {Object.entries(metrics.data.messages).map(([k, v]) => (
                    <Pill key={k}>
                      {states[k]} : {v}
                    </Pill>
                  ))}
                </div>
                <p className="mt-3 text-meta text-ink-2">
                  Un message accepté par le fournisseur n’est pas déclaré livré
                  sans notification authentifiée.
                </p>
              </Card>
            </>
          ) : (
            <Skeleton className="h-40" />
          )}
        </>
      )}
      {tab === "Intégrations" && admin && (
        <Card className="space-y-4 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Plug size={20} />
            Échanges avec votre logiciel de gestion
          </h2>
          <p className="text-ink-2">
            API d’admissions idempotente et statuts administratifs.
            Import/export CSV disponible dans Parcours patients. Aucun
            connecteur éditeur n’est présenté comme certifié.
          </p>
          <form
            className="flex flex-wrap gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const v = fd(e.currentTarget);
              const r = await perform("/operations/connections", v);
              if (r) setSecret(String(r.token));
            }}
          >
            <label className="flex-1">
              Nom de la connexion
              <input
                className={input}
                name="name"
                required
                placeholder="Logiciel de la clinique — test"
              />
            </label>
            <Button className="self-end" disabled={busy}>
              Créer une clé d’intégration
            </Button>
          </form>
          {secret && (
            <div className="rounded-card bg-warning-bg p-4">
              <p>
                Clé affichée une seule fois. Conservez-la côté serveur, jamais
                dans le navigateur du patient.
              </p>
              <code className="block break-all select-all">{secret}</code>
              <button className="mt-2 underline" onClick={() => setSecret("")}>
                Masquer
              </button>
            </div>
          )}
          <div className="space-y-2">
            {connections.data?.items.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="flex-1">
                  {c.name} · {c.active ? "Active" : "Révoquée"}
                </span>
                {c.active && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      perform("/operations/connections/" + c.id, {}, "DELETE")
                    }
                  >
                    Révoquer
                  </Button>
                )}
              </div>
            ))}
          </div>
          <pre className="overflow-auto rounded-card bg-surface-2 p-4 text-meta">
            POST /api/operations/exchange/admissions{"\n"}GET
            /api/operations/exchange/status{"\n"}Header: X-Integration-Key
          </pre>
          <div className="rounded-card bg-surface-2 p-4">
            <h3 className="font-semibold">Logiciels repérés au Maroc</h3>
            <p className="mt-2 text-sm text-ink-2">
              Pistes de connexion à valider avec votre établissement, sans
              partenariat ni compatibilité certifiée revendiqués.
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              {[
                ["MASAHA", "https://www.masaha.ma/"],
                [
                  "MagicaHIS",
                  "https://www.magicahealthtech.com/references.html",
                ],
                ["Mibtech", "https://mibtech.ma/"],
                ["FireHIS", "https://firethunder.ma/"],
              ].map(([name, url]) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-700 underline"
                >
                  {name} ↗
                </a>
              ))}
            </div>
          </div>
          <p className="text-meta text-ink-2">
            Brevo : mode actuel {q.data?.messaging_provider ?? "—"}. Les clés et
            expéditeurs se configurent côté serveur.
          </p>
        </Card>
      )}
      {tab === "Réseau" && (
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">
            Vos établissements autorisés
          </h2>
          <p className="text-ink-2">{sites.data?.notice}</p>
          {sites.data?.items.map((s) => (
            <div
              className="flex flex-wrap items-center gap-4 rounded-card border border-line p-4"
              key={s.id}
            >
              <div className="flex-1">
                <strong>{s.name}</strong>
                <p>
                  {s.metrics.active} dossiers actifs · {s.metrics.ready_pct} %
                  complets administrativement
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={s.id === sites.data?.current}
                onClick={() => {
                  sessionStorage.setItem("m3aya_site", s.id);
                  location.href = "/operations";
                }}
              >
                Ouvrir cet établissement
              </Button>
            </div>
          ))}
        </Card>
      )}
      {selected && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-navy-900/35"
          role="dialog"
          aria-modal="true"
          aria-label="Dossier administratif"
        >
          <div className="glass-sheet case-panel h-full w-full max-w-3xl overflow-y-auto p-5">
            <div className="sticky top-0 z-10 mb-4 flex items-center justify-between gap-2 rounded-ctl bg-page p-3">
              <h2 className="text-xl font-semibold">
                {d?.reference ?? "Chargement…"} · dossier administratif
              </h2>
              <button aria-label="Fermer le dossier" onClick={closeDossier}>
                <X />
              </button>
            </div>
            <nav
              aria-label="Rubriques du dossier"
              className="sticky top-[68px] z-10 mb-4 flex flex-wrap gap-2 rounded-ctl bg-page p-2"
            >
              {[
                ["resume", "Résumé"],
                ["coordination", "Coordination"],
                ["aide", "Aide"],
                ["documents", "Documents"],
                ["assurance", "Assurance"],
                ["finances", "Finances"],
                ["communications", "Communications"],
                ["historique", "Historique"],
              ].map(([key, label]) =>
                ["resume", "documents"].includes(key) ? (
                  <Link
                    key={key}
                    className="rounded-ctl border px-3 py-2"
                    to={`/parcours/${selected}?onglet=${key}`}
                  >
                    {label}
                  </Link>
                ) : (
                  <button
                    key={key}
                    aria-pressed={section === key}
                    className={
                      "min-h-11 rounded-ctl border px-3 py-2 hover:bg-mint-100 " +
                      (section === key
                        ? "bg-mint-100 font-semibold text-teal-800"
                        : "")
                    }
                    onClick={() =>
                      setParams((previous) => {
                        const next = new URLSearchParams(previous);
                        next.set("dossier", selected!);
                        next.set("section", key);
                        return next;
                      })
                    }
                  >
                    {label}
                  </button>
                ),
              )}
            </nav>
            {error && (
              <p
                role="alert"
                className="mb-3 rounded-card bg-critical-bg p-3 text-critical-text"
              >
                {error}
              </p>
            )}
            {detail.isError ? (
              <ErrorState onRetry={detail.refetch} />
            ) : !d ? (
              <Skeleton className="h-40" />
            ) : (
              <div className="space-y-4">
                {section === "aide" && d.support.length === 0 && (
                  <Card className="p-5">
                    <h3 className="font-semibold">Demandes d’aide</h3>
                    <p className="mt-2 text-ink-2">
                      Aucune demande d’aide pour ce dossier.
                    </p>
                  </Card>
                )}
                <Card className="p-5">
                  <h3 className="text-lg font-semibold">{d.patient.name}</h3>
                  <p className="text-ink-2">
                    {d.patient.phone || "Téléphone non renseigné"} ·{" "}
                    {d.patient.email || "E-mail non renseigné"}
                  </p>
                  <Link
                    className="mt-3 inline-flex items-center gap-2 text-teal-700"
                    to={"/parcours/" + d.id}
                  >
                    Ouvrir les documents et le parcours{" "}
                    <ArrowUpRight size={16} />
                  </Link>
                  <p className="mt-3">
                    {d.preparation.missing} pièce(s) bloquante(s) ·{" "}
                    {d.preparation.submitted} pièce(s) reçue(s) à vérifier
                  </p>
                </Card>
                {write && (
                  <Card hidden={section !== "coordination"} className="p-5">
                    <h3 className="font-semibold">
                      Affectation, transmission et situation
                    </h3>
                    <form
                      key={d.id + ":" + d.revision}
                      className="mt-3 grid gap-3 sm:grid-cols-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        perform(
                          "/operations/cases/" + d.id,
                          { ...fd(e.currentTarget), revision: d.revision },
                          "PUT",
                        );
                      }}
                    >
                      <label>
                        Responsable
                        <select
                          className={input}
                          name="assigned_subject"
                          defaultValue={d.assigned_subject}
                        >
                          <option value="">À affecter</option>
                          {team.data?.items
                            .filter((m) => m.active)
                            .map((m) => (
                              <option key={m.subject} value={m.subject}>
                                {m.display_name}
                                {!m.available ? " (absent)" : ""}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Service
                        <input
                          className={input}
                          name="department"
                          defaultValue={d.department}
                          required
                        />
                      </label>
                      <label>
                        État administratif
                        <select
                          className={input}
                          name="phase"
                          defaultValue={d.phase}
                        >
                          {["preparing", "ready", "arrived", "closed"].map(
                            (k) => (
                              <option value={k} key={k}>
                                {states[k]}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        Situation particulière
                        <select
                          className={input}
                          name="exception"
                          defaultValue={d.exception}
                        >
                          <option value="">Aucune</option>
                          {[
                            ["no_smartphone", "Sans smartphone"],
                            ["unreadable_document", "Document illisible"],
                            ["insurance_wait", "Assurance sans réponse"],
                            ["rescheduled", "Date déplacée"],
                            ["contact_issue", "Contact à vérifier"],
                          ].map(([k, v]) => (
                            <option value={k} key={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button disabled={busy}>Confirmer la transmission</Button>
                    </form>
                    <p className="mt-3 text-meta text-ink-2">
                      La complétude administrative ne conditionne pas les soins
                      urgents. Aucun statut médical n’est calculé.
                    </p>
                  </Card>
                )}
                <Card hidden={section !== "assurance"} className="p-5">
                  <h3
                    id="case-assurance"
                    tabIndex={-1}
                    className="scroll-mt-4 font-semibold"
                  >
                    Prises en charge et assurances
                  </h3>
                  <div className="mt-3 space-y-3">
                    {d.insurance.map((i) => (
                      <div
                        key={i.id}
                        className="rounded-card border border-line p-3"
                      >
                        <p>
                          <strong>{i.insurer}</strong> · {i.reference} ·{" "}
                          <Pill>{states[i.status]}</Pill>
                        </p>
                        <p className="mt-2 text-ink-2">{i.note}</p>
                        {write && (
                          <form
                            className="mt-3 flex flex-wrap gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              perform(
                                "/operations/insurance/" + i.id,
                                {
                                  ...fd(e.currentTarget),
                                  revision: i.revision,
                                },
                                "PUT",
                              );
                            }}
                          >
                            <select
                              aria-label="Nouvel état assurance"
                              className={input + " flex-1"}
                              name="status"
                            >
                              {(
                                {
                                  draft: ["submitted"],
                                  submitted: [
                                    "more_info",
                                    "approved",
                                    "rejected",
                                  ],
                                  more_info: [
                                    "submitted",
                                    "approved",
                                    "rejected",
                                  ],
                                  approved: [],
                                  rejected: ["draft"],
                                }[i.status] ?? []
                              ).map((k) => (
                                <option value={k} key={k}>
                                  {states[k]}
                                </option>
                              ))}
                            </select>
                            <input
                              aria-label="Note assurance"
                              className={input}
                              name="note"
                              placeholder="Référence et vérification administrative, sans contenu médical"
                              maxLength={2000}
                            />
                            <Button
                              disabled={busy || i.status === "approved"}
                              size="sm"
                            >
                              Confirmer l’état reçu
                            </Button>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                  {write && (
                    <form
                      className="mt-4 grid gap-3 sm:grid-cols-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const b = fd(e.currentTarget);
                        perform("/operations/cases/" + d.id + "/insurance", {
                          ...b,
                          due_date: b.due_date || null,
                        });
                      }}
                    >
                      <label>
                        Organisme
                        <input
                          className={input}
                          name="insurer"
                          required
                          placeholder="CNSS, mutuelle, assurance…"
                        />
                      </label>
                      <label>
                        Référence de la demande
                        <input className={input} name="reference" />
                      </label>
                      <label>
                        À suivre avant le
                        <input className={input} type="date" name="due_date" />
                      </label>
                      <label>
                        Note administrative
                        <input className={input} name="note" maxLength={2000} />
                      </label>
                      <Button disabled={busy}>Préparer une demande</Button>
                    </form>
                  )}
                  <p className="mt-3 text-meta text-ink-2">
                    Suivi des démarches uniquement. Aucun accord d’assurance ni
                    justificatif médical n’est généré.
                  </p>
                </Card>
                <Card hidden={section !== "finances"} className="p-5">
                  <h3
                    id="case-finances"
                    tabIndex={-1}
                    className="scroll-mt-4 font-semibold"
                  >
                    Suivi financier administratif · MAD
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {[
                      ["Devis confirmé", d.finance.quote],
                      ["Couverture enregistrée", d.finance.coverage],
                      [
                        "Part patient estimative",
                        d.finance.estimated_patient_share,
                      ],
                      ["Solde estimatif", d.finance.balance],
                    ].map(([l, n]) => (
                      <div
                        className="rounded-card bg-surface-2 p-3"
                        key={String(l)}
                      >
                        <p className="text-meta text-ink-2">{l}</p>
                        <strong>{money(Number(n))}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-meta text-ink-2">
                    {d.finance.notice}
                  </p>
                  {write && (
                    <form
                      className="mt-4 grid gap-3 sm:grid-cols-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const b = fd(e.currentTarget);
                        perform("/operations/cases/" + d.id + "/finance", {
                          kind: b.kind,
                          reference: b.reference,
                          amount_cents: Math.round(Number(b.amount) * 100),
                          confirmed: b.confirmed === "on",
                        });
                      }}
                    >
                      <label>
                        Écriture
                        <select className={input} name="kind">
                          {[
                            ["quote", "Devis confirmé"],
                            ["coverage", "Couverture confirmée"],
                            ["deposit", "Acompte reçu hors plateforme"],
                            [
                              "refund",
                              "Remboursement effectué hors plateforme",
                            ],
                          ].map(([k, v]) => (
                            <option value={k} key={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Montant en MAD
                        <input
                          className={input}
                          name="amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                        />
                      </label>
                      <label>
                        Référence du justificatif
                        <input
                          className={input}
                          name="reference"
                          required
                          maxLength={120}
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="confirmed" required />
                        J’ai vérifié le justificatif.
                      </label>
                      <Button disabled={busy}>Enregistrer l’écriture</Button>
                    </form>
                  )}
                  <ul className="mt-4 space-y-2 text-sm">
                    {d.finance.entries.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center gap-2 border-t border-line pt-2"
                      >
                        <span className="flex-1">
                          {entryLabels[r.kind] ?? r.kind} ·{" "}
                          {money(r.amount_cents)} · {r.reference}{" "}
                          {r.voided ? "· annulée" : ""}
                        </span>
                        {admin && !r.voided && r.kind !== "void" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              const reason = window.prompt(
                                "Motif de correction (3 caractères minimum)",
                              );
                              if (reason)
                                perform(
                                  "/operations/finance/" + r.id + "/void",
                                  { reason },
                                );
                            }}
                          >
                            Corriger par annulation
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card hidden={section !== "communications"} className="p-5">
                  <h3
                    id="case-communications"
                    tabIndex={-1}
                    className="scroll-mt-4 font-semibold"
                  >
                    Communications et reprise humaine
                  </h3>
                  <p className="mt-2 text-meta text-ink-2">
                    {q.data?.messaging_provider === "console"
                      ? "Simulation : aucun message externe ne sera envoyé."
                      : "Envoi externe après confirmation humaine, pendant les horaires configurés par l’établissement."}{" "}
                    Un rappel maximum par 24 h.
                  </p>
                  {write && (
                    <form
                      className="mt-3 flex flex-wrap gap-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        perform("/operations/cases/" + d.id + "/messages", {
                          ...fd(e.currentTarget),
                          request_key: crypto.randomUUID(),
                          approved: true,
                        });
                      }}
                    >
                      <select
                        className={input}
                        name="template"
                        aria-label="Modèle de communication"
                      >
                        <option value="documents">
                          Une étape administrative attend le patient
                        </option>
                        <option value="contact">
                          Contacter le service des admissions
                        </option>
                        <option value="reminder">
                          Consulter ses prochaines étapes
                        </option>
                      </select>
                      <select
                        className={input}
                        name="channel"
                        aria-label="Canal de communication"
                      >
                        {["auto", "email", "sms", "whatsapp"].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" required />
                        Je valide l’envoi du modèle administratif.
                      </label>
                      <Button disabled={busy}>Confirmer et transmettre</Button>
                    </form>
                  )}
                  <div className="mt-4 space-y-2">
                    {messages.data?.items.map((m) => (
                      <div
                        className="rounded-card border border-line p-3"
                        key={m.id}
                      >
                        <Pill
                          tone={m.status === "failed" ? "critical" : "neutral"}
                        >
                          {states[m.status] ?? m.status}
                        </Pill>
                        <p className="mt-2">{m.body}</p>
                        {write && m.status === "inbound" && (
                          <Button
                            className="mt-2"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              perform("/operations/messages/" + m.id + "/read")
                            }
                          >
                            Marquer la réponse traitée
                          </Button>
                        )}
                        {write &&
                          ["failed", "sending", "simulated"].includes(
                            m.status,
                          ) && (
                            <Button
                              className="mt-2"
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                const reason = window.prompt(
                                  "Comment avez-vous joint le patient ?",
                                );
                                if (reason)
                                  perform(
                                    "/operations/messages/" + m.id + "/manual",
                                    { reason },
                                  );
                              }}
                            >
                              Déclarer le contact manuel
                            </Button>
                          )}
                      </div>
                    ))}
                  </div>
                </Card>
                {d.support.length > 0 && (
                  <Card hidden={section !== "aide"} className="p-5">
                    <h3 className="font-semibold">Demandes d’aide</h3>
                    {d.support.map((s) => (
                      <div className="mt-3" key={s.id}>
                        <p>
                          {s.message} · {s.status}
                        </p>
                        {write && s.status === "open" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              perform(
                                "/operations/support/" + s.id + "/resolve",
                              )
                            }
                          >
                            Marquer résolue
                          </Button>
                        )}
                      </div>
                    ))}
                  </Card>
                )}
                {write && (
                  <Card hidden={section !== "coordination"} className="p-5">
                    <h3 className="font-semibold">
                      Déplacer la date administrative
                    </h3>
                    <form
                      className="mt-3 space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        perform(
                          "/operations/cases/" + d.id + "/reschedule",
                          fd(e.currentTarget),
                        );
                      }}
                    >
                      <label>
                        Date fournie par l’établissement
                        <input
                          className={input}
                          type="date"
                          name="date"
                          required
                        />
                      </label>
                      <label>
                        Motif administratif
                        <input
                          className={input}
                          name="reason"
                          required
                          minLength={3}
                        />
                      </label>
                      <Button variant="secondary" disabled={busy}>
                        Confirmer et décaler les tâches non terminées
                      </Button>
                    </form>
                    <p className="mt-2 text-meta text-ink-2">
                      Cette action ne choisit ni acte ni date médicale.
                    </p>
                  </Card>
                )}
                <Card hidden={section !== "historique"} className="p-5">
                  <h3
                    id="case-historique"
                    tabIndex={-1}
                    className="scroll-mt-4 font-semibold"
                  >
                    Transmissions et historique
                  </h3>
                  {write && (
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = e.currentTarget;
                        const r = await perform(
                          "/operations/cases/" + d.id + "/notes",
                          fd(f),
                        );
                        if (r) f.reset();
                      }}
                    >
                      <input
                        className={input}
                        name="text"
                        aria-label="Commentaire interne administratif"
                        placeholder="Transmission administrative, sans donnée médicale"
                        required
                        maxLength={2000}
                      />
                      <Button className="self-end" disabled={busy}>
                        Ajouter
                      </Button>
                    </form>
                  )}
                  <div className="mt-4 space-y-3">
                    {d.events.map((e) => (
                      <div className="rounded-card bg-surface-2 p-3" key={e.id}>
                        <p className="text-meta text-ink-2">
                          {eventLabels[e.kind] ?? e.kind} ·{" "}
                          {new Date(e.created_at).toLocaleString("fr-FR")}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words">
                          {describe(e.text)}
                        </p>
                        {write && e.kind === "profile_requested" && (
                          <Button
                            className="mt-2"
                            size="sm"
                            onClick={() =>
                              perform(
                                "/operations/events/" +
                                  e.id +
                                  "/confirm-profile",
                              )
                            }
                          >
                            Vérifier et confirmer ces coordonnées
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
