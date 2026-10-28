import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { roles } from "@/auth";
import { api, download } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, useToast } from "@/components/ui";

type Stats = { completeness_rate: number | null; avg_completion_delay_days: number | null; reminders_sent: number; minutes_saved_estimate: number; note: string };

export default function ReportsPage() {
  const toast = useToast();
  const stats = useQuery({ queryKey: ["analytics"], queryFn: () => api<Stats>("/analytics") });
  const dl = (path: string, name: string) => download(path, name).catch(() => toast({ tone: "critical", title: "Export impossible", text: "Droits insuffisants ou serveur indisponible." }));
  const admin = roles().includes("admin");
  return (
    <div className="space-y-5">
      <h1 className="text-[28px] font-semibold tracking-tight">Rapports</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Parcours patients</CardTitle></CardHeader><CardContent>
          <p className="text-ink-2">Un fichier CSV (séparateur « ; », compatible Excel) avec référence, intervention, date, étape, progression, statut et responsable. L'export est tracé dans le journal d'audit.</p>
          <Button className="mt-3" variant="secondary" onClick={() => dl("/journeys/export.csv", "parcours.csv")}><Download size={16} />Exporter les parcours</Button></CardContent></Card>
        {admin && <Card><CardHeader><CardTitle>Journal d'audit</CardTitle></CardHeader><CardContent>
          <p className="text-ink-2">Qui a fait quoi, quand : validations, téléchargements de pièces, exports, demandes de droits. Réservé aux administrateurs.</p>
          <Button className="mt-3" variant="secondary" onClick={() => dl("/audit/export.csv", "journal-audit.csv")}><Download size={16} />Exporter le journal</Button></CardContent></Card>}
      </div>
      {stats.data && <Card><CardHeader><CardTitle>Synthèse</CardTitle></CardHeader><CardContent>
        <ul className="grid gap-2 md:grid-cols-2">
          <li>Complétude : <strong>{stats.data.completeness_rate === null ? "—" : `${Math.round(stats.data.completeness_rate * 100)} %`}</strong></li>
          <li>Délai moyen de complétion : <strong>{stats.data.avg_completion_delay_days ?? "—"} j</strong></li>
          <li>Relances : <strong>{stats.data.reminders_sent}</strong></li><li>Temps économisé (estimation) : <strong>{stats.data.minutes_saved_estimate} min</strong></li></ul>
        <p className="mt-2 text-meta text-ink-2">{stats.data.note}</p></CardContent></Card>}
    </div>
  );
}
