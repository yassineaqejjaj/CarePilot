import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { setPatientSession } from "@/auth";
import { useLang } from "@/i18n";
import { Button, Logo } from "@/components/ui";

/** Page publique du lien sécurisé : jeton du lien + date de naissance => session patient courte. */
export default function PatientEntry() {
  const { token } = useParams();
  const nav = useNavigate();
  const [lang, setLang, t] = useLang();
  const [birth, setBirth] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const r = await fetch("/api/portal/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, birth_date: birth }) });
    if (!r.ok) return setState("error");
    setPatientSession(await r.json());
    nav("/portal", { replace: true });
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-[430px] flex-col justify-center gap-6 px-5 text-patient">
      <div className="flex items-center justify-between"><Logo size={36} />
        <button className="rounded-ctl border border-line-strong px-3 py-1 text-sm" onClick={() => setLang(lang === "fr" ? "ar" : "fr")}>{lang === "fr" ? "العربية" : "Français"}</button></div>
      <form onSubmit={go} className="space-y-4 rounded-panel border border-line bg-white p-6 shadow-card">
        <h1 className="text-[22px] font-semibold">{t("entry.title")}</h1>
        <p className="text-ink-2">{t("entry.text")}</p>
        <label className="block"><span className="text-sm font-semibold text-navy-900">{t("entry.birth")}</span>
          <input inputMode="numeric" autoComplete="bday" placeholder="14/03/1986" value={birth} onChange={(e) => setBirth(e.target.value)} dir="ltr"
            className="mt-1 h-[52px] w-full rounded-ctl border border-line-strong px-3 text-base" required /></label>
        {state === "error" && <p role="alert" className="rounded-ctl bg-critical-bg p-3 text-critical-text">{t("entry.error")}</p>}
        <Button size="patient" disabled={state === "busy"}>{state === "busy" ? t("entry.wait") : t("entry.go")}</Button>
      </form>
    </div>
  );
}
