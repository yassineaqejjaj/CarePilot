import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import type { JourneyList } from "@/lib/types";
import JourneysTable from "@/components/JourneysTable";
import { ErrorState, Skeleton } from "@/components/ui";

export default function JourneysPage() {
  const [sp] = useSearchParams();
  const { data, error, refetch } = useQuery({ queryKey: ["journeys"], queryFn: () => api<JourneyList>("/journeys") });
  return (
    <div className="space-y-5">
      <h1 className="text-[28px] font-semibold tracking-tight">Parcours patients</h1>
      {error ? <ErrorState onRetry={refetch} /> : !data ? <Skeleton className="h-96" /> : <JourneysTable data={data} query={sp.get("q") ?? ""} />}
    </div>
  );
}
