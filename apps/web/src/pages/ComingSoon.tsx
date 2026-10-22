import { EmptyState } from "@/components/ui";
export default function ComingSoon({ title }: { title: string }) {
  return (<div className="space-y-4"><h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
    <EmptyState title="Bientôt disponible" text="Ce module n'est pas encore développé dans cette démonstration." /></div>);
}
