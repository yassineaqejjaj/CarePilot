import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ---- Boutons (planche §05) ---- */
const button = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ctl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-teal-700 text-white hover:bg-teal-800",
        secondary: "border border-line-strong bg-white text-navy-900 hover:bg-surface-2",
        ghost: "text-teal-700 hover:bg-mint-100",
        danger: "border border-critical/40 bg-white text-critical-text hover:bg-critical-bg",
      },
      size: { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", patient: "h-[52px] px-5 text-base w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...p }, ref) => (
  <button ref={ref} className={cn(button({ variant, size }), className)} {...p} />
));
Button.displayName = "Button";

/* ---- Cartes ---- */
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-card border border-line bg-white shadow-card", className)} {...p} />
);

/* ---- Statuts : pastilles (planche §06) ---- */
const TONES = {
  success: "bg-success-bg text-success-text", warning: "bg-warning-bg text-warning-text",
  info: "bg-info-bg text-info-text", critical: "bg-critical-bg text-critical-text",
  neutral: "bg-surface-2 text-ink-2", mint: "bg-mint-100 text-teal-800",
} as const;
export type Tone = keyof typeof TONES;
export const Pill = ({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) => (
  <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-meta font-semibold", TONES[tone], className)} {...p} />
);
/** Priorités : tags carrés, jamais en pilule. */
export const PriorityTag = ({ priority, children }: { priority: "urgent" | "high" | "medium" | "ready"; children: React.ReactNode }) => {
  const t = { urgent: "critical", high: "warning", medium: "info", ready: "success" } as const;
  return <span className={cn("inline-flex rounded-tag border px-2 py-0.5 text-meta font-semibold",
    { urgent: "border-critical/30", high: "border-warning/40", medium: "border-info/30", ready: "border-success/30" }[priority], TONES[t[priority]])}>{children}</span>;
};
export const STATE_TONE: Record<string, Tone> = { completed: "neutral", late: "critical", action: "warning", waiting_patient: "info", on_track: "success" };

/** Provenance IA : fond menthe, contour pointillé (planche §06). */
export const AiTag = ({ children = "Suggestion CarePilot" }: { children?: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-tag border border-dashed border-teal-500/60 bg-mint-100 px-2 py-0.5 text-meta font-semibold text-teal-800">
    <TraceMark size={12} /> {children}
  </span>
);

/* ---- Progression ---- */
export const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <div className="h-full rounded-full bg-teal-500" style={{ width: `${value}%` }} />
  </div>
);

export const Avatar = ({ name, className }: { name: string; className?: string }) => (
  <span aria-hidden className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint-100 text-[11px] font-semibold text-teal-800", className)}>
    {name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
  </span>
);

/* ---- Logo (symbole « trajet guidé ») ---- */
export const Logo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
    <rect width="32" height="32" rx="9" fill="#14263D" />
    <path d="M9 23C9 17 16 20 16 16C16 12 23 15 23 9" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    <circle cx="9" cy="23" r="2.6" fill="#14263D" stroke="#FFFFFF" strokeWidth="1.8" />
    <circle cx="16" cy="16" r="2.2" fill="#14263D" stroke="#FFFFFF" strokeWidth="1.8" />
    <circle cx="23" cy="9" r="3.2" fill="#3CC2B0" />
  </svg>
);
export const TraceMark = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
    <path d="M6 26C6 18 16 22 16 16C16 10 26 14 26 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <circle cx="26" cy="6" r="4" fill="currentColor" />
  </svg>
);

/* ---- États vides / erreur (planche §09) ---- */
export const EmptyState = ({ title, text }: { title: string; text?: string }) => (
  <div className="rounded-card border border-dashed border-line-strong bg-white px-6 py-10 text-center">
    <p className="font-semibold text-navy-900">{title}</p>{text && <p className="mt-1 text-ink-2">{text}</p>}
  </div>
);
export const ErrorState = ({ onRetry }: { onRetry?: () => void }) => (
  <div role="alert" className="rounded-card border border-critical/30 bg-critical-bg px-6 py-8 text-center">
    <p className="font-semibold text-critical-text">Impossible de charger les données</p>
    <p className="mt-1 text-ink-2">La connexion au serveur a échoué.</p>
    {onRetry && <Button className="mt-3" variant="secondary" size="sm" onClick={onRetry}>Réessayer</Button>}
  </div>
);
export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-card bg-surface-2", className)} />;

/* ---- Modale de confirmation (planche §10) ---- */
export function Confirm({ open, title, children, confirmLabel, onConfirm, onCancel, busy }: {
  open: boolean; title: string; children: React.ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-panel bg-white p-6 shadow-modal">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-ink-2">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button onClick={onConfirm} disabled={busy}>{busy ? "Envoi…" : confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---- Notifications (planche §08) ---- */
type ToastMsg = { id: number; tone: Tone; title: string; text?: string };
const ToastCtx = React.createContext<(t: Omit<ToastMsg, "id">) => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastMsg[]>([]);
  const push = React.useCallback((t: Omit<ToastMsg, "id">) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 6000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn("rounded-card border border-line bg-white p-3 shadow-menu", { success: "border-l-4 border-l-success", critical: "border-l-4 border-l-critical", warning: "border-l-4 border-l-warning" }[t.tone as string])}>
            <p className="font-semibold text-navy-900">{t.title}</p>{t.text && <p className="text-ink-2">{t.text}</p>}
          </div>))}
      </div>
    </ToastCtx.Provider>
  );
}

/* Aides de composition de carte (utilisées par Designer / Analyses) */
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("p-5 pb-2", className)} {...p} />;
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn("text-lg font-semibold text-navy-900", className)} {...p} />;
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("p-5 pt-2", className)} {...p} />;
