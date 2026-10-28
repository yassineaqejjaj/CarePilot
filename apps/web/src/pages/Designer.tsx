import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ReactFlow, { Background, Controls, MarkerType, Position, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import Simulator from "@/components/Simulator";
import { api } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Pill } from "@/components/ui";

type Step = { offset_days: number; title: string; kind: "task" | "document" | "questionnaire" | "message"; required_document: string | null; blocking: boolean };
type Template = { id: string; name: string; version: number; status: "draft" | "published" | "archived"; steps: Step[] };

const stepSchema = z.object({
  title: z.string().min(2, "Titre requis"),
  offset_days: z.coerce.number().int().min(-60).max(60),
  kind: z.enum(["task", "document", "questionnaire", "message"]),
  required_document: z.string().optional(),
  blocking: z.boolean(),
});
type StepForm = z.infer<typeof stepSchema>;
const dayLabel = (d: number) => (d === 0 ? "J" : d < 0 ? `J${d}` : `J+${d}`);

export default function Designer() {
  const qc = useQueryClient();
  const { data: templates } = useQuery({ queryKey: ["templates"], queryFn: () => api<Template[]>("/templates") });
  const [simulating, setSimulating] = useState(false);
  const [tplId, setTplId] = useState<string>();
  const [steps, setSteps] = useState<Step[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const tpl = templates?.find((t) => t.id === tplId);
  const editable = tpl?.status === "draft";
  const refresh = () => qc.invalidateQueries({ queryKey: ["templates"] });

  useEffect(() => { if (templates && !tplId && templates.length) setTplId(templates[templates.length - 1].id); }, [templates, tplId]);
  useEffect(() => { setSteps(tpl?.steps ?? []); setSel(null); }, [tpl?.id, tpl?.steps]);

  const save = useMutation({ mutationFn: () => api(`/templates/${tplId}/steps`, { method: "PUT", body: JSON.stringify(steps) }), onSuccess: refresh });
  const publish = useMutation({ mutationFn: () => api(`/templates/${tplId}/publish`, { method: "POST" }), onSuccess: refresh });
  const newVersion = useMutation({
    mutationFn: () => api<{ id: string }>(`/templates/${tplId}/new-version`, { method: "POST" }),
    onSuccess: (r) => { setTplId(r.id); refresh(); },
  });
  const seed = useMutation({ mutationFn: () => api("/templates/seed-ambulatory", { method: "POST" }), onSuccess: refresh });

  const { nodes, edges } = useMemo(() => {
    const order = steps.map((s, i) => ({ s, i })).sort((a, b) => a.s.offset_days - b.s.offset_days || a.i - b.i);
    // Disposition en serpentin : 4 étapes par ligne, une ligne sur deux inversée, liaison verticale en bout de ligne.
    const nodes: Node[] = order.map(({ s, i }, col) => {
      const row = Math.floor(col / 4), pos = col % 4, ltr = row % 2 === 0;
      return {
        id: String(i), position: { x: (ltr ? pos : 3 - pos) * 200, y: row * 110 }, selected: i === sel,
        sourcePosition: pos === 3 ? Position.Bottom : ltr ? Position.Right : Position.Left,
        targetPosition: pos === 0 && row > 0 ? Position.Top : ltr ? Position.Left : Position.Right,
        data: { label: `${dayLabel(s.offset_days)} · ${s.title}${s.blocking ? " ⛔" : ""}` },
        style: { width: 170, fontSize: 12, border: s.blocking ? "2px solid #CD5962" : "1px solid #CBD3DB", borderRadius: 8 },
      };
    });
    const edges: Edge[] = order.slice(1).map(({ i }, k) => ({
      id: `e${k}`, type: "smoothstep", source: String(order[k].i), target: String(i), markerEnd: { type: MarkerType.ArrowClosed },
    }));
    return { nodes, edges };
  }, [steps, sel]);

  const form = useForm<StepForm>({ resolver: zodResolver(stepSchema) });
  useEffect(() => {
    if (sel !== null && steps[sel]) form.reset({ ...steps[sel], required_document: steps[sel].required_document ?? "" });
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const apply = form.handleSubmit((v) => {
    if (sel === null) return;
    const next = [...steps];
    next[sel] = { ...v, required_document: v.kind === "document" ? v.required_document || null : null };
    setSteps(next);
  });

  if (!templates) return <p>Chargement…</p>;
  if (templates.length === 0) return <Button onClick={() => seed.mutate()}>Créer le parcours chirurgie ambulatoire</Button>;
  return (
    <div className="space-y-4">
      {simulating && <Simulator steps={steps} onClose={() => setSimulating(false)} />}
      <div className="flex items-center gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight">Concepteur de parcours</h1>
        <select aria-label="Version" className="h-9 rounded-ctl border border-line-strong px-2 text-sm" value={tplId} onChange={(e) => setTplId(e.target.value)}>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name} — v{t.version}</option>)}
        </select>
        {tpl && <Pill tone={tpl.status === "published" ? "success" : "neutral"}>{tpl.status === "published" ? "Publié" : tpl.status === "draft" ? "Brouillon" : "Archivé"}</Pill>}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setSimulating(true)}>Tester ce parcours</Button>
          {editable ? (
            <>
              <Button variant="secondary" disabled={save.isPending} onClick={() => save.mutate()}>Enregistrer</Button>
              <Button disabled={publish.isPending} onClick={() => publish.mutate()}>Publier</Button>
            </>
          ) : (
            <Button variant="secondary" disabled={newVersion.isPending} onClick={() => newVersion.mutate()}>Nouvelle version</Button>
          )}
        </div>
      </div>
      {!editable && <p className="text-sm text-ink-2">Un parcours publié est immuable : créez une nouvelle version pour le modifier. Les dossiers existants gardent leur version.</p>}
      <div className="grid grid-cols-[1fr_300px] gap-4">
        <div className="h-[460px] rounded-card border border-line bg-white">
          <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} onNodeClick={(_, n) => setSel(Number(n.id))}>
            <Background /><Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <Card>
          <CardHeader><CardTitle>{sel === null ? "Étape" : "Modifier l'étape"}</CardTitle></CardHeader>
          <CardContent>
            {sel === null ? <p className="text-sm text-ink-2">Sélectionnez une étape du parcours.</p> : (
              <form onSubmit={apply} className="space-y-3 text-sm">
                <label className="block">Titre<input className="mt-1 h-9 w-full rounded-ctl border border-line-strong px-2" disabled={!editable} {...form.register("title")} /></label>
                {form.formState.errors.title && <p className="text-critical-text">{form.formState.errors.title.message}</p>}
                <label className="block">Jour (J-21 → -21)<input type="number" className="mt-1 h-9 w-full rounded-ctl border border-line-strong px-2" disabled={!editable} {...form.register("offset_days")} /></label>
                <label className="block">Type
                  <select className="mt-1 h-9 w-full rounded-ctl border border-line-strong px-2" disabled={!editable} {...form.register("kind")}>
                    <option value="task">Tâche</option><option value="document">Document</option><option value="questionnaire">Questionnaire</option><option value="message">Message</option>
                  </select></label>
                <label className="block">Document requis (code)<input className="mt-1 h-9 w-full rounded-ctl border border-line-strong px-2" disabled={!editable} {...form.register("required_document")} /></label>
                <label className="flex items-center gap-2"><input type="checkbox" disabled={!editable} {...form.register("blocking")} />Étape bloquante</label>
                {editable && (
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Appliquer</Button>
                    <Button type="button" size="sm" variant="danger" onClick={() => { setSteps(steps.filter((_, i) => i !== sel)); setSel(null); }}>Supprimer</Button>
                  </div>)}
              </form>)}
            {editable && <Button className="mt-4" size="sm" variant="secondary" onClick={() => { setSteps([...steps, { offset_days: 0, title: "Nouvelle étape", kind: "task", required_document: null, blocking: false }]); setSel(steps.length); }}>+ Ajouter une étape</Button>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
