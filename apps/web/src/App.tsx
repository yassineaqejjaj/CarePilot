import { lazy, Suspense, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Bell, Bot, Building2, CheckSquare, ChevronDown, FileText, GitBranch, LayoutDashboard, Layers, LogOut, MessageSquare, Route as RouteIcon, Search, Settings as SettingsIcon, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { displayName, logout, patientSession, roles } from "@/auth";
import { api } from "@/lib/api";
import { roleLabel } from "@/lib/format";
import type { Cockpit, Me } from "@/lib/types";
import { Avatar, Logo } from "@/components/ui";
import { cn } from "@/lib/utils";
import CockpitPage from "@/pages/Cockpit";
import JourneysPage from "@/pages/Journeys";
import JourneyDetailPage from "@/pages/JourneyDetail";
import ValidationPage from "@/pages/Validation";
import Agents from "@/pages/Agents";
import Portal from "@/pages/Portal";
import PatientEntry from "@/pages/PatientEntry";
import Tasks from "@/pages/Tasks";
import Communications from "@/pages/Communications";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import { LiveUpdates, LiveBadge } from "@/lib/live";
import ComingSoon from "@/pages/ComingSoon";

const Catalogue = lazy(() => import("@/pages/Catalogue"));
const Designer = lazy(() => import("@/pages/Designer"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Copilot = lazy(() => import("@/pages/Copilot"));
const GuidedDemo = lazy(() => import("@/pages/GuidedDemo"));
const Procedures = lazy(() => import("@/pages/Procedures"));

type Item = { to: string; label: string; icon: React.ReactNode; badge?: number | string; tone?: "red" | "mint" };

function Sidebar({ canDesign, tasks, journeys, validation }: { canDesign: boolean; tasks?: number; journeys?: number; validation?: number }) {
  const ic = (C: LucideIcon) => <C size={18} />;
  const groups: { title: string; items: Item[] }[] = [
    { title: "Espace de travail", items: [
      { to: "/", label: "Vue d'ensemble", icon: ic(LayoutDashboard) },
      { to: "/parcours", label: "Parcours patients", icon: ic(RouteIcon), badge: journeys },
      { to: "/taches", label: "Tâches", icon: ic(CheckSquare), badge: tasks, tone: "red" },
      { to: "/communications", label: "Communications", icon: ic(MessageSquare) }] },
    { title: "Automatisation", items: [
      ...(canDesign ? [{ to: "/concepteur", label: "Concepteur de parcours", icon: ic(GitBranch) }] : []),
      { to: "/agents", label: "Agents IA", icon: ic(Bot) },
      { to: "/copilote", label: "Copilote d’action", icon: ic(Bot) },
      { to: "/demo", label: "Démo guidée", icon: ic(LayoutDashboard) },
      { to: "/procedures", label: "Procédures patient", icon: ic(FileText) },
      { to: "/validation", label: "File de validation", icon: ic(ShieldCheck), badge: validation, tone: "mint" as const }] },
    { title: "Pilotage", items: [
      { to: "/analyses", label: "Analyses", icon: ic(BarChart3) },
      { to: "/rapports", label: "Rapports", icon: ic(FileText) }] },
    { title: "Administration", items: [
      { to: "/equipe", label: "Équipe", icon: ic(Users) },
      { to: "/modeles", label: "Catalogue de parcours", icon: ic(Layers) },
      { to: "/parametres", label: "Paramètres", icon: ic(SettingsIcon) }] },
  ];
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col overflow-y-auto border-r border-line bg-white px-3 py-4 lg:flex">
      <div className="mb-5 flex items-center gap-2.5 px-2">
        <Logo /><div className="leading-tight"><span className="text-lg font-semibold text-navy-900">M3aya <span className="text-teal-700">Santé</span></span><p className="mt-0.5 text-meta text-ink-2" lang="ar">معايا · à chaque étape</p></div>
      </div>
      {groups.map((g) => (
        <nav key={g.title} aria-label={g.title} className="mb-4">
          <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-teal-700">{g.title}</p>
          {g.items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === "/"} className={({ isActive }) =>
              cn("flex items-center gap-3 rounded-ctl px-2.5 py-2 font-medium text-ink hover:bg-surface-2", isActive && "bg-mint-100 font-semibold text-teal-800")}>
              <span className="text-ink-2">{i.icon}</span><span className="flex-1">{i.label}</span>
              {i.badge !== undefined && i.badge !== 0 && (
                <span className={cn("rounded-full px-1.5 text-meta font-semibold", i.tone === "red" ? "bg-critical-bg text-critical-text" : i.tone === "mint" ? "bg-mint-100 text-teal-800" : "text-ink-2")}>{i.badge}</span>)}
            </NavLink>))}
        </nav>))}
      <p className="mt-auto rounded-ctl bg-surface-2 p-2.5 text-meta text-ink-2">Environnement de démonstration. Toutes les données sont fictives.</p>
    </aside>
  );
}

function Topbar({ me, pending }: { me?: Me; pending?: number }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-white/95 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-2.5 rounded-card border border-line bg-white px-3 py-1.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-ctl bg-mint-100 text-teal-700"><Building2 size={16} /></span>
        <div className="leading-tight"><p className="text-meta text-ink-2">Établissement</p><p className="font-semibold text-navy-900">{me?.establishment ?? "…"}</p></div>
        <ChevronDown size={14} className="text-ink-2" />
      </div>
      <form className="relative max-w-xl flex-1" onSubmit={(e) => { e.preventDefault(); nav(`/parcours?q=${encodeURIComponent(q)}`); }} role="search">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2" />
        <input aria-label="Rechercher un patient, un parcours, un identifiant" value={q} onChange={(e) => setQ(e.target.value)}
          className="h-10 w-full rounded-ctl border border-transparent bg-surface-2 pl-9 pr-3 placeholder:text-ink-2 focus:border-teal-500 focus:bg-white"
          placeholder="Rechercher un patient, un parcours, un identifiant…" />
      </form>
      <button aria-label="Notifications" className="relative ml-auto rounded-ctl p-2 text-ink-2 hover:bg-surface-2" onClick={() => nav("/validation")}>
        <Bell size={18} />{!!pending && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-critical" />}
      </button>
      <div className="flex items-center gap-2.5">
        <Avatar name={displayName()} className="h-9 w-9 text-xs" />
        <div className="leading-tight"><p className="font-semibold text-navy-900">{displayName()}</p><p className="text-meta text-ink-2">{roleLabel(roles())}</p></div>
        <button aria-label="Déconnexion" title="Déconnexion" className="rounded-ctl p-2 text-ink-2 hover:bg-surface-2" onClick={() => logout()}><LogOut size={16} /></button>
      </div>
    </header>
  );
}

export default function App() {
  if (roles().includes("patient") || window.location.pathname.startsWith("/p/")) {
    return (
      <Routes>
        <Route path="/p/:token" element={patientSession() ? <Navigate to="/portal" replace /> : <PatientEntry />} />
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
  const cockpit = useQuery({ queryKey: ["cockpit"], queryFn: () => api<Cockpit>("/cockpit") });
  const k = cockpit.data?.kpis;
  return (
    <div className="flex min-h-screen">
      <Sidebar canDesign={canDesign} tasks={k?.tasks_to_treat} journeys={k?.active} validation={cockpit.data?.validation_pending} />
      <div className="min-w-0 flex-1">
        <LiveUpdates />
        <Topbar me={me.data} pending={cockpit.data?.validation_pending} />
        <main className="mx-auto max-w-[1180px] px-6 py-6">
          <Suspense fallback={<p role="status" className="p-6 text-ink-2">Chargement…</p>}>
          <Routes>
            <Route path="/" element={<CockpitPage />} />
            <Route path="/parcours" element={<JourneysPage />} />
            <Route path="/parcours/:id" element={<JourneyDetailPage />} />
            <Route path="/validation" element={<ValidationPage />} />
            {canDesign && <Route path="/concepteur" element={<Designer />} />}
            <Route path="/agents" element={<Agents />} />
            <Route path="/copilote" element={<Copilot />} />
            <Route path="/demo" element={<GuidedDemo />} />
            <Route path="/procedures" element={<Procedures />} />
            <Route path="/modeles" element={<Catalogue />} />
            <Route path="/analyses" element={<Analytics />} />
            <Route path="/taches" element={<Tasks />} />
            <Route path="/communications" element={<Communications />} />
            <Route path="/rapports" element={<Reports />} />
            {isAdmin && <Route path="/parametres" element={<Settings />} />}
            {[["equipe", "Équipe"], ...(isAdmin ? [] : [["parametres", "Paramètres"]])].map(([p, t]) =>
              <Route key={p} path={`/${p}`} element={<ComingSoon title={t} />} />)}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
