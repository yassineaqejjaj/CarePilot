import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import type { JourneyList } from "@/lib/types";
import JourneysTable from "@/components/JourneysTable";
import { useState } from "react";
import { Plus } from "lucide-react";
import NewJourney from "@/components/NewJourney";
import { Button, ErrorState, Skeleton } from "@/components/ui";

export default function JourneysPage() {
  const [sp] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const { data, error, refetch } = useQuery({ queryKey: ["journeys"], queryFn: () => api<JourneyList>("/journeys") });
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h1 className="text-[28px] font-semibold tracking-tight">Parcours patients</h1>
        <Button onClick={() => setCreating(true)}><Plus size={16} />Nouveau parcours</Button></div>
      {creating && <NewJourney onClose={() => setCreating(false)} />}
      {error ? <ErrorState onRetry={refetch} /> : !data ? <Skeleton className="h-96" /> : <JourneysTable data={data} query={sp.get("q") ?? ""} />}
    </div>
  );
}
