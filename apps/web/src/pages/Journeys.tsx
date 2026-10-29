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
  const [sp,setSp] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const { data, error, refetch } = useQuery({ queryKey: ["journeys"], queryFn: () => api<JourneyList>("/journeys") });
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h1 className="text-[28px] font-semibold tracking-tight">Dossiers patients</h1>
        <Button onClick={() => setCreating(true)}><Plus size={16} />Nouveau dossier</Button></div>
      <label className="block">Rechercher un dossier<input aria-label="Rechercher dans les dossiers" className="mt-2 min-h-11 w-full rounded-ctl border border-line bg-white px-3" placeholder="Nom, référence ou prise en charge" value={sp.get("q")??""} onChange={e=>setSp(e.target.value?{q:e.target.value}:{},{replace:true})}/></label>
      {creating && <NewJourney onClose={() => setCreating(false)} />}
      {error ? <ErrorState onRetry={refetch} /> : !data ? <Skeleton className="h-96" /> : <JourneysTable data={data} query={sp.get("q") ?? ""} />}
    </div>
  );
}
