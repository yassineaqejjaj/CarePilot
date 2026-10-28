import { useState } from "react";
import { useParams } from "react-router-dom";
import { setPatientSession } from "@/auth";
import { BrandLogo, Button } from "@/components/ui";
export default function CompanionEntry() {
  const { token } = useParams();
  const [ar, setAr] = useState(false),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main
      className="mx-auto max-w-[430px] space-y-5 p-6"
      dir={ar ? "rtl" : "ltr"}
    >
      <div className="flex items-center justify-between">
        <BrandLogo className="h-auto w-24" />
        <button onClick={() => setAr(!ar)}>
          {ar ? "Français" : "العربية"}
        </button>
      </div>
      <h1 className="text-2xl font-semibold">
        {ar ? "فضاء المرافق" : "Espace accompagnant"}
      </h1>
      <p className="text-ink-2">
        {ar
          ? "أدخلوا الرمز الذي أرسله المريض بشكل منفصل. صلاحياتكم محدودة بالوثائق والمراسلات الإدارية."
          : "Saisissez le code transmis séparément par le patient. Votre accès se limite aux documents et échanges administratifs."}
      </p>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr("");
          try {
            const code = new FormData(e.currentTarget).get("code");
            const r = await fetch("/api/operations/companion/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, code }),
            });
            if (!r.ok) throw Error();
            setPatientSession(await r.json());
            location.href = "/portal";
          } catch {
            setErr(
              ar
                ? "الرابط أو الرمز غير صالح أو منتهي."
                : "Lien ou code invalide, expiré ou révoqué.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block">
          {ar ? "الرمز المكون من 6 أرقام" : "Code à 6 chiffres"}
          <input
            className="mt-2 w-full rounded-card border border-line-strong p-3"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            required
            maxLength={6}
            dir="ltr"
          />
        </label>
        {err && (
          <p role="alert" className="text-critical-text">
            {err}
          </p>
        )}
        <Button size="patient" disabled={busy}>
          {ar ? "فتح الفضاء" : "Ouvrir mon accès"}
        </Button>
      </form>
    </main>
  );
}
