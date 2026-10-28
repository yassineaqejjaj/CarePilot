import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui";

/** Validation humaine d'une proposition CarePilot. Aucun SMS/e-mail réel n'est envoyé dans cette démo. */
export function useProposal() {
  const qc = useQueryClient();
  const toast = useToast();
  const done = () => ["cockpit", "journeys", "proposals", "journey"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const approve = useMutation({
    mutationFn: (id: string) => api<{ delivery: { status: "simulated" | "sent" | "failed"; channel: string; to: string; error: string } | null }>(`/ai/proposals/${id}/approve`, { method: "POST" }),
    onSuccess: (r) => {
      done();
      const d = r.delivery;
      if (!d) toast({ tone: "success", title: "Proposition validée" });
      else if (d.status === "sent") toast({ tone: "success", title: "Message envoyé", text: `${d.channel} · ${d.to}` });
      else if (d.status === "simulated") toast({ tone: "warning", title: "Proposition validée", text: "Démo : l'envoi est simulé, aucun message réel n'est parti." });
      else toast({ tone: "critical", title: "Validée, mais l'envoi a échoué", text: d.error || "Vérifiez la configuration de la messagerie." });
    },
    onError: () => toast({ tone: "critical", title: "Validation impossible", text: "Réessayez dans un instant." }),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api(`/ai/proposals/${id}/reject`, { method: "POST" }),
    onSuccess: () => { done(); toast({ tone: "warning", title: "Proposition rejetée" }); },
  });
  return { approve, reject };
}
