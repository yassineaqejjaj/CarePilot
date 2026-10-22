import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { JourneyList, State } from "@/lib/types";
import { Avatar, Card, Pill, Progress, STATE_TONE } from "@/components/ui";
import { jLabel, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHIPS: [State | "all", string][] = [["all", "Tous"], ["on_track", "En bonne voie"], ["action", "Action requise"], ["waiting_patient", "En attente patient"], ["late", "En retard"], ["completed", "Terminé"]];

export default function JourneysTable({ data, limit, query = "" }: { data: JourneyList; limit?: number; query?: string }) {
  const [f, setF] = useState<State | "all">("all");
  const rows = useMemo(() => data.items.filter((r) => (f === "all" || r.state === f) &&
    (!query || `${r.patient_name} ${r.reference} ${r.procedure}`.toLowerCase().includes(query.toLowerCase()))), [data, f, query]);
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4" role="tablist" aria-label="Filtrer les parcours">
        {CHIPS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={f === k} onClick={() => setF(k)}
            className={cn("rounded-full border px-3 py-1 text-[13px] font-medium", f === k ? "border-teal-700 bg-mint-100 text-teal-800" : "border-line-strong bg-white text-ink hover:bg-surface-2")}>
            {label} <span className="ml-1 text-ink-2">{k === "all" ? data.total : data.counts[k]}</span>
          </button>))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-meta uppercase tracking-wide text-ink-2"><tr>
            {["Patient", "Intervention", "Date", "Étape", "Progression", "Statut", "Responsable", ""].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.journey_id} className="border-t border-line hover:bg-page">
                <td className="px-4 py-3"><Link className="font-semibold text-navy-900 hover:underline" to={`/parcours/${r.journey_id}`}>{r.patient_name}</Link><p className="text-meta tabular-nums text-ink-2">{r.reference}</p></td>
                <td className="px-4 py-3">{r.procedure}</td>
                <td className="px-4 py-3 tabular-nums">{shortDate(r.surgery_date)}<p className="text-meta text-ink-2">{r.days_to_surgery >= 0 ? jLabel(r.days_to_surgery) : `J+${-r.days_to_surgery}`}</p></td>
                <td className="px-4 py-3">{r.stage}</td>
                <td className="w-36 px-4 py-3"><div className="flex items-center gap-2"><Progress value={r.progress} /><span className="whitespace-nowrap text-meta tabular-nums">{r.progress} %</span></div></td>
                <td className="px-4 py-3"><Pill tone={STATE_TONE[r.state]}>{r.state_label}</Pill></td>
                <td className="px-4 py-3"><span className="flex items-center gap-2"><Avatar name={r.owner || "—"} />{r.owner}</span></td>
                <td className="px-2"><Link aria-label={`Ouvrir ${r.patient_name}`} to={`/parcours/${r.journey_id}`} className="text-ink-2"><ChevronRight size={16} /></Link></td>
              </tr>))}
            {shown.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-2">Aucun parcours ne correspond à ce filtre.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
