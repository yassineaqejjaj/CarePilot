import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import type { JourneyList } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, ErrorState, Skeleton } from "@/components/ui";

type Stats = { completeness_rate: number | null; avg_completion_delay_days: number | null; reminders_sent: number; automated_tasks: number; minutes_saved_estimate: number; note: string };
type Usage = { agent: string; calls: number; input_tokens: number; output_tokens: number; cost_eur: number }[];
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

export default function AnalyticsPage() {
  const stats = useQuery({ queryKey: ["analytics"], queryFn: () => api<Stats>("/analytics") });
  const list = useQuery({ queryKey: ["journeys"], queryFn: () => api<JourneyList>("/journeys") });
  const usage = useQuery({ queryKey: ["ai-usage"], queryFn: () => api<Usage>("/ai/usage"), retry: false });
  if (stats.error) return <ErrorState onRetry={stats.refetch} />;
  if (!stats.data) return <Skeleton className="h-96" />;
  const s = stats.data;
  const kpis: [string, string][] = [
    ["Complétude des dossiers", pct(s.completeness_rate)],
    ["Délai moyen de complétion", s.avg_completion_delay_days === null ? "—" : `${s.avg_completion_delay_days} j`],
    ["Relances", String(s.reminders_sent)],
    ["Temps économisé (estimation)", `${s.minutes_saved_estimate} min`],
  ];
  const rows = (list.data?.items ?? []).filter((j) => j.state !== "completed").map((j) => ({ patient: j.patient_name.split(" ")[0], progression: j.progress }));
  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold tracking-tight">Analyses</h1>
      <Link className="block rounded-panel border border-line bg-mint-100 p-4 text-teal-800" to="/operations?onglet=mesures">Mesurer les résultats du pilote à partir d’observations réelles →</Link>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map(([l, v]) => (<Card key={l} className="p-4"><p className="text-ink-2">{l}</p><p className="mt-2 text-[40px] font-bold leading-none tracking-tight text-navy-900 tabular-nums">{v}</p></Card>))}
      </div>
      <p className="text-meta text-ink-2">{s.note}</p>
      <Card>
        <CardHeader><CardTitle>Progression par dossier actif (%)</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer><BarChart data={rows}><CartesianGrid stroke="#E3E8EC" vertical={false} /><XAxis dataKey="patient" tick={{ fill: "#5B6678", fontSize: 12 }} /><YAxis domain={[0, 100]} tick={{ fill: "#5B6678", fontSize: 12 }} /><Tooltip />
            <Bar dataKey="progression" name="Progression" fill="#168C88" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </CardContent>
      </Card>
      {usage.data && usage.data.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Consommation IA ce mois (tokens)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer><BarChart data={usage.data}><CartesianGrid stroke="#E3E8EC" vertical={false} /><XAxis dataKey="agent" /><YAxis /><Tooltip />
              <Bar dataKey="input_tokens" name="Entrée" stackId="t" fill="#168C88" /><Bar dataKey="output_tokens" name="Sortie" stackId="t" fill="#D99730" /></BarChart></ResponsiveContainer>
            <p className="mt-1 text-meta text-ink-2">Coût estimé : {usage.data.reduce((a, u) => a + u.cost_eur, 0).toFixed(4)} €</p>
          </CardContent>
        </Card>)}
    </div>
  );
}
