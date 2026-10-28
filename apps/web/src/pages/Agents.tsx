import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";
import { AiTag, Card, Pill } from "@/components/ui";

type Usage = { agent: string; calls: number; input_tokens: number; output_tokens: number; cost_eur: number }[];
const AGENTS = [
  ["administrative", "Vérification administrative", "Identifie les documents manquants et signale les anomalies au coordinateur."],
  ["communication", "Communication", "Prépare des messages à partir de modèles approuvés, toujours soumis à validation."],
  ["followup", "Suivi", "Classe les réponses des patients et propose les prochaines actions autorisées."],
  ["summary", "Synthèse", "Résume les interactions administratives pour le coordinateur."],
];

export default function Agents() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const usage = useQuery({ queryKey: ["ai-usage"], queryFn: () => api<Usage>("/ai/usage"), retry: false });
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3"><h1 className="text-[28px] font-semibold tracking-tight">Agents IA</h1>
        <Pill tone={me.data?.ai_enabled ? "success" : "warning"}>{me.data?.ai_enabled ? "IA activée" : "IA désactivée"}</Pill></div>
      {me.data?.ai_blocked_reason && <p className="rounded-card bg-warning-bg p-3 text-warning-text">{me.data.ai_blocked_reason}</p>}
      <p className="text-ink-2">Aucune décision médicale. Aucun envoi sans validation humaine. Les données patient directement identifiantes ne sont jamais transmises au modèle.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {AGENTS.map(([k, t, d]) => {
          const u = usage.data?.find((x) => x.agent === k);
          return (<Card key={k} className="p-5"><AiTag>{t}</AiTag><p className="mt-3">{d}</p>
            <p className="mt-3 text-meta tabular-nums text-ink-2">{u ? `${u.calls} appels ce mois · ${u.input_tokens + u.output_tokens} tokens · ${u.cost_eur.toFixed(4)} €` : "Aucun appel ce mois"}</p></Card>);
        })}
      </div>
      <p className="rounded-card bg-surface-2 p-3 text-meta text-ink-2">Dans cette démonstration en ligne, aucune clé OpenAI n'est configurée : les propositions affichées sont préparées à l'avance (modèles approuvés ou données de démo).</p>
    </div>
  );
}
