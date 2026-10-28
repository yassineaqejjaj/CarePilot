import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { Proposal } from "@/lib/types";
import { useProposal } from "@/lib/useProposal";
import { AiTag, Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";

const DOC: Record<string, string> = { cin: "CIN ou passeport", attestation_amo: "attestation AMO", mutuelle: "prise en charge mutuelle / assurance", consentement_admin: "consentement administratif", questionnaire_admission: "questionnaire d'admission" };
const KIND: Record<string, string> = { message_draft: "Message à valider", verification: "Vérification administrative", followup: "Réponse patient classée", summary: "Synthèse" };

export default function ValidationPage() {
  const { approve, reject } = useProposal();
  const { data, error, refetch } = useQuery({ queryKey: ["proposals"], queryFn: () => api<Proposal[]>("/ai/proposals?status=pending") });
  return (
    <div className="space-y-5">
      <div className="space-y-1"><h1 className="text-[28px] font-semibold tracking-tight">File de validation</h1>
        <p className="text-ink-2">Tout ce que M3aya Santé prépare attend ici votre validation. Rien ne part sans vous.</p></div>
      {error ? <ErrorState onRetry={refetch} /> : !data ? <Skeleton className="h-64" /> : data.length === 0 ? <EmptyState title="Aucune tâche en attente" text="Tous les parcours du jour sont à jour." /> : (
        <ul className="space-y-4">
          {data.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-center gap-3"><AiTag /><span className="font-semibold text-navy-900">{KIND[p.kind] ?? p.kind}</span></div>
              {p.kind === "message_draft" ? <blockquote dir="auto" className="mt-3 whitespace-pre-wrap rounded-card border border-line bg-page p-4">{p.payload.body}</blockquote> : (
                <div className="mt-3"><p>{p.payload.summary}</p>
                  {p.payload.missing_documents?.length > 0 && <p className="mt-2 text-ink-2">Pièces manquantes : {p.payload.missing_documents.map((c: string) => DOC[c] ?? c).join(", ")}</p>}
                  <ul className="mt-2 list-disc pl-5">{(p.payload.anomalies ?? []).map((x: string) => <li key={x}>{x}</li>)}</ul></div>)}
              <div className="mt-4 flex gap-2">
                <Button variant="danger" size="sm" onClick={() => reject.mutate(p.id)}>Rejeter</Button>
                <Button size="sm" onClick={() => approve.mutate(p.id)}>Approuver</Button>
              </div>
            </Card>))}
        </ul>)}
      <Link to="/parcours" className="inline-block font-semibold text-teal-700 hover:underline">Voir les parcours</Link>
    </div>
  );
}
