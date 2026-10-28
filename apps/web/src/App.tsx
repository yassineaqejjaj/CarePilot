import { lazy, Suspense, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  Bot,
  Building2,
  CheckSquare,
  ChevronDown,
  FileText,
  GitBranch,
  LayoutDashboard,
  Layers,
  LogOut,
  MessageSquare,
  Route as RouteIcon,
  Search,
  Settings as SettingsIcon,
  HelpCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { displayName, logout, patientSession, roles, subject } from "@/auth";
import { api } from "@/lib/api";
import { roleLabel } from "@/lib/format";
import type { Cockpit, Me } from "@/lib/types";
import { Avatar, BrandLogo } from "@/components/ui";
import { cn } from "@/lib/utils";
import CockpitPage from "@/pages/Cockpit";
import JourneysPage from "@/pages/Journeys";
import JourneyDetailPage from "@/pages/JourneyDetail";
import Agents from "@/pages/Agents";
import Portal from "@/pages/Portal";
import PatientEntry from "@/pages/PatientEntry";
import Tasks from "@/pages/Tasks";
import Communications from "@/pages/Communications";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import { LiveUpdates } from "@/lib/live";
import ComingSoon from "@/pages/ComingSoon";

const Operations = lazy(() => import("@/pages/Operations"));
const CompanionEntry = lazy(() => import("@/pages/CompanionEntry"));
const Catalogue = lazy(() => import("@/pages/Catalogue"));
const Designer = lazy(() => import("@/pages/Designer"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Copilot = lazy(() => import("@/pages/Copilot"));
const GuidedDemo = lazy(() => import("@/pages/GuidedDemo"));
const Procedures = lazy(() => import("@/pages/Procedures"));

type Item = {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  tone?: "red" | "mint";
};

function Sidebar({
  canDesign,
  isAdmin,
  multiSite,
  pending,
}: {
  canDesign: boolean;
  isAdmin: boolean;
  multiSite: boolean;
  pending?: number;
}) {
  const ic = (C: LucideIcon) => <C size={18} />;
  const groups: { title: string; items: Item[] }[] = [
    {
      title: "Au quotidien",
      items: [
        {
          to: "/vue-ensemble",
          label: "Vue d’ensemble",
          icon: ic(LayoutDashboard),
        },
        {
          to: "/operations",
          label: "À traiter",
          icon: ic(CheckSquare),
          badge: pending,
          tone: "red",
        },
        { to: "/parcours", label: "Dossiers patients", icon: ic(RouteIcon) },
        {
          to: "/communications",
          label: "Communications",
          icon: ic(MessageSquare),
        },
      ],
    },
    {
      title: "Parcours & automatisations",
      items: [
        { to: "/modeles", label: "Bibliothèque de parcours", icon: ic(Layers) },
        ...(canDesign
          ? [{ to: "/concepteur", label: "Concepteur", icon: ic(GitBranch) }]
          : []),
        { to: "/automatisations", label: "Automatisations", icon: ic(Bot) },
        {
          to: "/procedures",
          label: "Procédures administratives",
          icon: ic(FileText),
        },
      ],
    },
    {
      title: "Pilotage",
      items: [
        { to: "/resultats", label: "Résultats du pilote", icon: ic(BarChart3) },
        { to: "/rapports", label: "Rapports", icon: ic(FileText) },
        ...(multiSite
          ? [
              {
                to: "/etablissements",
                label: "Établissements",
                icon: ic(Building2),
              },
            ]
          : []),
      ],
    },
    ...(isAdmin
      ? [
          {
            title: "Administration",
            items: [
              { to: "/equipe", label: "Équipe & accès", icon: ic(Users) },
              { to: "/integrations", label: "Intégrations", icon: ic(Layers) },
              {
                to: "/parametres",
                label: "Paramètres",
                icon: ic(SettingsIcon),
              },
            ],
          },
        ]
      : []),
    {
      title: "Aide",
      items: [{ to: "/demo", label: "Démo guidée", icon: ic(HelpCircle) }],
    },
  ];
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col overflow-y-auto border-r border-line bg-white px-3 py-4 lg:flex">
      <div className="mb-5 flex flex-col items-center px-2">
        <BrandLogo className="h-auto w-[120px]" />
        <p className="mt-1 text-center text-[11px] text-ink-2">
          Votre parcours de soins.
          <br />
          Notre accompagnement.
        </p>
      </div>
      {groups.map((g) => (
        <nav key={g.title} aria-label={g.title} className="mb-4">
          <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-teal-700">
            {g.title}
          </p>
          {g.items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === "/app"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-ctl px-2.5 py-2 font-medium text-ink hover:bg-surface-2",
                  isActive && "bg-mint-100 font-semibold text-teal-800",
                )
              }
            >
              <span className="text-ink-2">{i.icon}</span>
              <span className="flex-1">{i.label}</span>
              {i.badge !== undefined && i.badge !== 0 && (
                <span
                  title="Dossiers à traiter : attribués à vous ou sans responsable (tous pour un administrateur)"
                  className={cn(
                    "rounded-full px-1.5 text-meta font-semibold",
                    i.tone === "red"
                      ? "bg-critical-bg text-critical-text"
                      : i.tone === "mint"
                        ? "bg-mint-100 text-teal-800"
                        : "text-ink-2",
                  )}
                >
                  {i.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      ))}
      <p className="mt-auto rounded-ctl bg-surface-2 p-2.5 text-meta text-ink-2">
        Environnement de démonstration. Toutes les données sont fictives.
      </p>
    </aside>
  );
}

function Topbar({
  me,
  pending,
  multiSite,
}: {
  me?: Me;
  pending?: number;
  multiSite: boolean;
}) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-white/95 px-3 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2.5 rounded-card border border-line bg-white px-3 py-1.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-ctl bg-mint-100 text-teal-700">
          <Building2 size={16} />
        </span>
        <div className="leading-tight">
          <p className="text-meta text-ink-2">Établissement</p>
          <p className="font-semibold text-navy-900">
            {me?.establishment ?? "…"}
          </p>
        </div>
        {multiSite && (
          <button
            aria-label="Changer d’établissement"
            className="flex h-9 w-9 items-center justify-center rounded-ctl hover:bg-surface-2"
            onClick={() => nav("/etablissements")}
          >
            <ChevronDown size={14} className="text-ink-2" />
          </button>
        )}
      </div>
      <form
        className="relative order-last w-full md:order-none md:w-auto md:max-w-xl md:flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          nav(`/parcours?q=${encodeURIComponent(q)}`);
        }}
        role="search"
      >
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2"
        />
        <input
          aria-label="Rechercher un patient, un parcours, un identifiant"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-10 w-full rounded-ctl border border-transparent bg-surface-2 pl-9 pr-3 placeholder:text-ink-2 focus:border-teal-500 focus:bg-white"
          placeholder="Rechercher un patient, un parcours, un identifiant…"
        />
      </form>
      <button
        aria-label="Notifications"
        className="relative ml-auto rounded-ctl p-2 text-ink-2 hover:bg-surface-2"
        onClick={() => nav("/operations?onglet=validations")}
      >
        <Bell size={18} />
        {!!pending && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-critical" />
        )}
      </button>
      <div className="flex items-center gap-2.5">
        <Avatar name={displayName()} className="h-9 w-9 text-xs" />
        <div className="hidden leading-tight sm:block">
          <p className="font-semibold text-navy-900">{displayName()}</p>
          <p className="text-meta text-ink-2">{roleLabel(roles())}</p>
        </div>
        <button
          aria-label="Déconnexion"
          title="Déconnexion"
          className="rounded-ctl p-2 text-ink-2 hover:bg-surface-2"
          onClick={() => logout()}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

export default function App() {
  if (
    roles().includes("patient") ||
    window.location.pathname.startsWith("/p/") ||
    window.location.pathname.startsWith("/accompagner/")
  ) {
    return (
      <Routes>
        <Route
          path="/accompagner/:token"
          element={
            <Suspense fallback={<p>Chargement…</p>}>
              <CompanionEntry />
            </Suspense>
          }
        />
        <Route
          path="/p/:token"
          element={
            patientSession() ? (
              <Navigate to="/portal" replace />
            ) : (
              <PatientEntry />
            )
          }
        />
        <Route path="/portal" element={<Portal />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    );
  }
  return <StaffApp />;
}

function StaffApp() {
  const r = roles();
  const canDesign = r.includes("admin") || r.includes("designer");
  const isAdmin = r.includes("admin");
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const cockpit = useQuery({
    queryKey: ["cockpit"],
    queryFn: () => api<Cockpit>("/cockpit"),
  });
  const [more, setMore] = useState(false);
  const sites = useQuery({
    queryKey: ["operations-sites"],
    queryFn: () => api<{ items: { id: string }[] }>("/operations/sites"),
  });
  const work = useQuery({
    queryKey: ["operations-worklist"],
    queryFn: () =>
      api<{
        items: {
          assigned_subject: string | null;
          submitted: number;
          insurance_pending: number;
          help_pending: number;
          profile_pending: number;
          unread: number;
        }[];
      }>("/operations/worklist"),
  });
  const multiSite = (sites.data?.items.length ?? 0) > 1;
  const pending = work.data?.items.filter(
    (x) =>
      (isAdmin || !x.assigned_subject || x.assigned_subject === subject()) &&
      x.submitted +
        x.insurance_pending +
        x.help_pending +
        x.profile_pending +
        x.unread >
        0,
  ).length;
  const home =
    !isAdmin && r.includes("coordinator") ? "/operations" : "/vue-ensemble";
  return (
    <div className="flex min-h-screen">
      <Sidebar
        canDesign={canDesign}
        isAdmin={isAdmin}
        multiSite={multiSite}
        pending={pending}
      />
      <div className="min-w-0 flex-1">
        <LiveUpdates />
        <Topbar
          me={me.data}
          pending={cockpit.data?.validation_pending}
          multiSite={multiSite}
        />
        <nav
          className="flex items-center justify-around border-b border-line bg-white p-2 lg:hidden"
          aria-label="Navigation équipe mobile"
        >
          {[
            ["/app", "Accueil"],
            ["/operations", "À traiter"],
            ["/parcours", "Dossiers"],
            ["/communications", "Messages"],
          ].map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className="rounded-ctl px-2 py-3 text-sm text-teal-800"
            >
              {label}
            </NavLink>
          ))}
          <button
            aria-expanded={more}
            aria-controls="mobile-more"
            onClick={() => setMore(!more)}
            className="rounded-ctl px-2 py-3 text-sm text-teal-800"
          >
            Plus
          </button>
        </nav>
        {more && (
          <nav
            id="mobile-more"
            aria-label="Autres rubriques"
            className="grid gap-1 border-b border-line bg-white p-4 lg:hidden"
            onClick={() => setMore(false)}
          >
            {[
              ["/vue-ensemble", "Vue d’ensemble"],
              ["/modeles", "Bibliothèque de parcours"],
              ...(canDesign ? [["/concepteur", "Concepteur"]] : []),
              ["/automatisations", "Automatisations"],
              ["/procedures", "Procédures administratives"],
              ["/resultats", "Résultats du pilote"],
              ["/rapports", "Rapports"],
              ...(multiSite ? [["/etablissements", "Établissements"]] : []),
              ...(isAdmin
                ? [
                    ["/equipe", "Équipe & accès"],
                    ["/integrations", "Intégrations"],
                    ["/parametres", "Paramètres"],
                  ]
                : []),
              ["/demo", "Aide · Démo guidée"],
            ].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className="rounded-ctl p-3 hover:bg-mint-100"
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
        <main className="mx-auto max-w-[1180px] px-6 py-6">
          <Suspense
            fallback={
              <p role="status" className="p-6 text-ink-2">
                Chargement…
              </p>
            }
          >
            <Routes>
              <Route
                path="/app"
                element={
                  me.isPending ? (
                    <p>Chargement…</p>
                  ) : (
                    <Navigate to={home} replace />
                  )
                }
              />
              <Route path="/vue-ensemble" element={<CockpitPage />} />
              <Route path="/operations" element={<Operations />} />
              {isAdmin && (
                <Route path="/equipe" element={<Operations mode="Équipe" />} />
              )}
              {isAdmin && (
                <Route
                  path="/integrations"
                  element={<Operations mode="Intégrations" />}
                />
              )}
              {multiSite && (
                <Route
                  path="/etablissements"
                  element={<Operations mode="Réseau" />}
                />
              )}
              <Route
                path="/resultats"
                element={<Operations mode="Mesures" />}
              />
              <Route
                path="/demarrage"
                element={<Operations mode="Démarrage" />}
              />
              <Route path="/parcours" element={<JourneysPage />} />
              <Route path="/parcours/:id" element={<JourneyDetailPage />} />
              <Route
                path="/validation"
                element={
                  <Navigate to="/operations?onglet=validations" replace />
                }
              />
              {canDesign && <Route path="/concepteur" element={<Designer />} />}
              <Route path="/automatisations" element={<Automations />} />
              <Route
                path="/agents"
                element={<Navigate to="/automatisations" replace />}
              />
              <Route
                path="/copilote"
                element={
                  <Navigate to="/automatisations?onglet=copilote" replace />
                }
              />
              <Route path="/demo" element={<GuidedDemo />} />
              <Route path="/procedures" element={<Procedures />} />
              <Route path="/modeles" element={<Catalogue />} />
              <Route path="/analyses" element={<Analytics />} />
              <Route path="/taches" element={<Tasks />} />
              <Route path="/communications" element={<Communications />} />
              <Route path="/rapports" element={<Reports />} />
              {isAdmin && <Route path="/parametres" element={<Settings />} />}
              {[...(isAdmin ? [] : [["parametres", "Paramètres"]])].map(
                ([p, t]) => (
                  <Route
                    key={p}
                    path={`/${p}`}
                    element={<ComingSoon title={t} />}
                  />
                ),
              )}
              <Route path="*" element={<Navigate to="/app" />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function Automations() {
  const [params, setParams] = useSearchParams();
  const copilot = params.get("onglet") === "copilote";
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Automatisations</h1>
      <nav aria-label="Automatisations" className="flex gap-2">
        {[
          [false, "Agents IA"],
          [true, "Copilote d’action"],
        ].map(([active, label]) => (
          <button
            key={String(label)}
            aria-pressed={copilot === active}
            className={cn(
              "rounded-ctl border px-4 py-3",
              copilot === active && "bg-mint-100 text-teal-800",
            )}
            onClick={() => setParams(active ? { onglet: "copilote" } : {})}
          >
            {label}
          </button>
        ))}
      </nav>
      {copilot ? <Copilot /> : <Agents />}
    </div>
  );
}
