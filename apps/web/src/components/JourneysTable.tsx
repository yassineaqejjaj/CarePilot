import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { JourneyList, State } from "@/lib/types";
import {
  Avatar,
  Button,
  Card,
  Pill,
  Progress,
  STATE_TONE,
} from "@/components/ui";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDisplay, technicalExample } from "@/lib/display";

const CHIPS: [State | "all", string][] = [
  ["all", "Tous"],
  ["on_track", "En bonne voie"],
  ["action", "Action requise"],
  ["waiting_patient", "En attente patient"],
  ["late", "Échéance dépassée"],
  ["completed", "Terminé"],
];
const OPTIONAL = [
  ["stage", "Étape"],
  ["progress", "Progression"],
  ["owner", "Responsable"],
] as const;
export default function JourneysTable({
  data,
  limit,
  query = "",
}: {
  data: JourneyList;
  limit?: number;
  query?: string;
}) {
  const { hideTechnical } = useDisplay();
  const [f, setF] = useState<State | "all">("all");
  const [sort, setSort] = useState("date");
  const [columns, setColumns] = useState<string[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem("m3aya-columns") ?? "null");
      return Array.isArray(value)
        ? value.filter((x) => OPTIONAL.some(([key]) => key === x))
        : OPTIONAL.map(([key]) => key);
    } catch {
      return OPTIONAL.map(([key]) => key);
    }
  });
  const base = useMemo(
    () =>
      data.items.filter(
        (r) =>
          (!hideTechnical || !technicalExample(r.patient_name)) &&
          (!query ||
            `${r.patient_name} ${r.reference} ${r.procedure}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [data, hideTechnical, query],
  );
  const rows = useMemo(
    () =>
      base
        .filter((r) => f === "all" || r.state === f)
        .sort((a, b) =>
          sort === "patient"
            ? a.patient_name.localeCompare(b.patient_name, "fr")
            : a.surgery_date.localeCompare(b.surgery_date) ||
              a.patient_name.localeCompare(b.patient_name, "fr"),
        ),
    [base, f, sort],
  );
  const shown = limit ? rows.slice(0, limit) : rows;
  function toggle(key: string) {
    const next = columns.includes(key)
      ? columns.filter((x) => x !== key)
      : [...columns, key];
    setColumns(next);
    try {
      localStorage.setItem("m3aya-columns", JSON.stringify(next));
    } catch {
      /* Optional local setting. */
    }
  }
  return (
    <Card>
      <div
        className="flex flex-wrap items-center gap-2 border-b border-line p-4"
        role="tablist"
        aria-label="Filtrer les parcours"
      >
        {CHIPS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={f === key}
            onClick={() => setF(key)}
            className={cn(
              "min-h-11 rounded-full border px-3 py-2 text-[13px] font-medium",
              f === key
                ? "border-teal-700 bg-mint-100 text-teal-800"
                : "border-line-strong bg-white",
            )}
          >
            {label}{" "}
            <span className="ml-1 text-ink-2">
              {key === "all"
                ? base.length
                : base.filter((r) => r.state === key).length}{" "}
              dossiers
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <label className="text-sm">
          Trier les dossiers
          <select
            aria-label="Trier les dossiers"
            className="ml-2 min-h-11 rounded-ctl border border-line bg-white px-2"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="date">Date de prise en charge</option>
            <option value="patient">Nom du patient</option>
          </select>
        </label>
        <details className="relative hidden md:block">
          <summary className="min-h-11 cursor-pointer rounded-ctl border border-line bg-white px-3 py-2.5">
            Colonnes
          </summary>
          <div className="glass-sheet absolute left-0 top-full z-10 w-52 space-y-2 rounded-card border p-3 shadow-menu">
            {OPTIONAL.map(([key, label]) => (
              <label key={key} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={columns.includes(key)}
                  onChange={() => toggle(key)}
                />
                {label}
              </label>
            ))}
          </div>
        </details>
        {(f !== "all" || sort !== "date") && (
          <Button
            variant="ghost"
            onClick={() => {
              setF("all");
              setSort("date");
            }}
          >
            Effacer les filtres
          </Button>
        )}
        <p role="status" className="text-meta text-ink-2">
          {shown.length} dossier(s) affiché(s)
          {limit ? ` sur ${rows.length}` : ""}
        </p>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead className="text-meta uppercase tracking-wide text-ink-2">
            <tr>
              {[
                "Patient",
                "Prise en charge",
                "Date",
                ...(columns.includes("stage") ? ["Étape"] : []),
                ...(columns.includes("progress") ? ["Progression"] : []),
                "Statut",
                ...(columns.includes("owner") ? ["Responsable"] : []),
                "Action",
              ].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.journey_id}
                className="border-t border-line hover:bg-page"
              >
                <td className="px-4 py-3">
                  <Link
                    className="font-semibold text-navy-900 hover:underline"
                    to={`/parcours/${r.journey_id}`}
                  >
                    {r.patient_name}
                  </Link>
                  <p className="text-meta text-ink-2">{r.reference}</p>
                </td>
                <td className="px-4 py-3">{r.procedure}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {shortDate(r.surgery_date)}
                  <p className="text-meta text-ink-2">
                    {r.days_to_surgery >= 0
                      ? `J-${r.days_to_surgery}`
                      : `J+${-r.days_to_surgery}`}
                  </p>
                </td>
                {columns.includes("stage") && (
                  <td className="px-4 py-3">{r.stage}</td>
                )}
                {columns.includes("progress") && (
                  <td className="min-w-32 px-4 py-3">
                    <Progress value={r.progress} />
                    <span className="text-meta">{r.progress} %</span>
                  </td>
                )}
                <td className="px-4 py-3">
                  <Pill tone={STATE_TONE[r.state]}>{r.state_label}</Pill>
                </td>
                {columns.includes("owner") && (
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar name={r.owner || "—"} />
                      {r.owner || "À affecter"}
                    </span>
                  </td>
                )}
                <td className="px-3">
                  <Link
                    aria-label={`Examiner le dossier de ${r.patient_name}`}
                    className="inline-flex min-h-11 items-center rounded-ctl px-3 font-semibold text-teal-700 hover:bg-mint-100"
                    to={`/parcours/${r.journey_id}`}
                  >
                    Examiner le dossier
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 p-3 md:hidden" aria-label="Dossiers sur mobile">
        {shown.map((r) => (
          <article
            key={r.journey_id}
            className="rounded-card border border-line bg-white p-4"
          >
            <Link
              className="inline-block min-h-11 text-base font-semibold text-navy-900"
              to={`/parcours/${r.journey_id}`}
            >
              {r.patient_name}
            </Link>
            <p>{r.procedure}</p>
            <p className="mt-1 text-sm text-ink-2">
              {shortDate(r.surgery_date)} · {r.owner || "À affecter"}
            </p>
            <div className="mt-3">
              <Pill tone={STATE_TONE[r.state]}>{r.state_label}</Pill>
            </div>
            <div className="mt-3">
              <Progress value={r.progress} />
              <p className="mt-1 text-meta">
                {r.progress} % des étapes validées
              </p>
            </div>
            <Link
              className="mt-3 flex min-h-11 items-center justify-center rounded-ctl bg-teal-700 px-3 font-semibold text-white"
              to={`/parcours/${r.journey_id}`}
            >
              Examiner le dossier
            </Link>
          </article>
        ))}
      </div>
      {!shown.length && (
        <div className="p-6 text-center">
          <p>Aucun dossier ne correspond à ces filtres.</p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => {
              setF("all");
              setSort("date");
            }}
          >
            Revenir à tous les statuts
          </Button>
        </div>
      )}
    </Card>
  );
}
