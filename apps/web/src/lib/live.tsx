import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Short polling works through Vercel's proxy and across API replicas. No public event stream or URL token. */
export function LiveUpdates() {
  const qc = useQueryClient();
  const prev = useRef<string>();
  const live = useQuery({ queryKey: ["live-revision"], queryFn: () => api<{revision:string; checked_at:string}>("/live/revision"),
    refetchInterval: 3000, retry: false, refetchIntervalInBackground: false });
  useEffect(() => {
    const current = live.data?.revision;
    if (!current) return;
    if (prev.current && prev.current !== current) {
      ["cockpit", "journeys", "journey", "me-portal", "tasks", "messages", "proposals", "support", "blockers", "reading", "demo-detail"].forEach(k => qc.invalidateQueries({queryKey:[k]}));
    }
    prev.current = current;
  }, [live.data?.revision, qc]);
  return null;
}

export function LiveBadge() {
  const q = useQuery<{revision:string}>({queryKey:["live-revision"], enabled:false});
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-meta text-ink-2" title="Actualisation toutes les 3 secondes lorsque cette page est active">
    <span className={`h-1.5 w-1.5 rounded-full ${q.isError ? "bg-warning" : "bg-success"}`} />{q.isError ? "Connexion à vérifier" : "Suivi en direct"}</span>;
}
