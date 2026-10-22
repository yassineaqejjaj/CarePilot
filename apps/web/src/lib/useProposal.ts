import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui";

/** Validation humaine d'une proposition CarePilot. Aucun SMS/e-mail réel n'est envoyé dans cette démo. */
export function useProposal() {
  const qc = useQueryClient();
  const toast = useToast();
  const done = () => ["cockpit", "journeys", "proposals", "journey"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const approve = useMutation({
    mutationFn: (id: string) => api(`/ai/proposals/${id}/approve`, { method: "POST" }),
    onSuccess: () => { done(); toast({ tone: "success", title: "Proposition validée", text: "Démo : l'envoi SMS / e-mail est simulé, aucun message réel n'est parti." }); },
    onError: () => toast({ tone: "critical", title: "Validation impossible", text: "Réessayez dans un instant." }),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api(`/ai/proposals/${id}/reject`, { method: "POST" }),
    onSuccess: () => { done(); toast({ tone: "warning", title: "Proposition rejetée" }); },
  });
  return { approve, reject };
}
