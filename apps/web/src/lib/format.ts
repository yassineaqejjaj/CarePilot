const d = (iso: string) => new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
export const longDate = (iso: string) => d(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
export const shortDate = (iso: string) => d(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).replace(".", "");
export const dayMonth = (iso: string) => d(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
export const dateTime = (iso: string) => d(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " · " + d(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
export const jLabel = (n: number) => (n === 0 ? "J0" : n > 0 ? `J-${n}` : `J+${-n}`); // jours AVANT l'intervention
export const roleLabel = (roles: string[]) => (roles.includes("admin") ? "Administrateur" : roles.includes("coordinator") ? "Coordinateur de parcours" : roles.includes("designer") ? "Concepteur de parcours" : roles.includes("patient") ? "Patient" : "Lecture seule");
