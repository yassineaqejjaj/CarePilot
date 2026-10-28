import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button, Card, Pill } from "@/components/ui";
const field =
  "mt-1 block w-full rounded-ctl border border-line-strong bg-white p-2 text-base";
type Overview = {
  delegate: boolean;
  notifications_enabled: boolean;
  profile: {
    phone: string;
    email: string;
    language: string;
    preferred_channel: string;
  };
  delegations: {
    id: string;
    label: string;
    revoked: boolean;
    expires_at: string;
  }[];
  journeys: {
    id: string;
    reference: string;
    finance: {
      quote: number;
      estimated_patient_share: number;
      balance: number;
    };
    messages: { id: string; body: string; status: string }[];
  }[];
};
export default function PortalAdministration({
  journeyId,
  lang,
}: {
  journeyId: string;
  lang: "fr" | "ar";
}) {
  const ar = lang === "ar",
    qc = useQueryClient();
  const [err, setErr] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [grant, setGrant] = useState<{ link: string; code: string } | null>(null);
  const q = useQuery({
    queryKey: ["portal-operations"],
    queryFn: () => api<Overview>("/operations/portal/overview"),
  });
  async function send(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setErr("");
    try {
      const r = await api<Record<string, unknown>>(path, {
        method,
        body: method === "DELETE" ? undefined : JSON.stringify(body),
      });
      await qc.invalidateQueries({ queryKey: ["portal-operations"] });
      setNotice(
        ar
          ? "تم حفظ طلبكم. الفريق يتابع الخطوات المقبلة."
          : "Votre demande est enregistrée. L’équipe peut la suivre.",
      );
      return r;
    } catch (e) {
      setErr(
        e instanceof ApiError
          ? e.detail
          : ar
            ? "تعذر التسجيل"
            : "Enregistrement impossible",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  const data = q.data,
    j = data?.journeys.find((x) => x.id === journeyId);
  if (!data)
    return q.isError ? (
      <p className="text-sm text-critical-text">
        {ar
          ? "تعذر تحميل المتابعة الإدارية."
          : "Le suivi administratif est momentanément indisponible."}
      </p>
    ) : null;
  return (
    <section
      className="space-y-3"
      aria-label={ar ? "مرافقتي الإدارية" : "Mon accompagnement administratif"}
    >
      {data.delegate && (
        <Pill tone="info">
          {ar
            ? "فضاء المرافق · صلاحيات محدودة"
            : "Espace accompagnant · accès limité"}
        </Pill>
      )}
      {err && (
        <p
          role="alert"
          className="rounded-card bg-critical-bg p-3 text-sm text-critical-text"
        >
          {err}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-card bg-success-bg p-3 text-sm">
          {notice}
        </p>
      )}
      <details
        id="portal-help"
        className="rounded-panel border border-line bg-white p-4"
      >
        <summary className="cursor-pointer font-semibold">
          {ar
            ? "أحتاج إلى مساعدة أو أريد الرد"
            : "J’ai besoin d’aide / écrire à mon équipe"}
        </summary>
        <p className="mt-2 text-sm text-ink-2">
          {ar
            ? "للمسائل الإدارية فقط. في حالة طارئة، اتصلوا بالمؤسسة أو بخدمات الطوارئ."
            : "Pour vos démarches administratives. En cas d’urgence, contactez votre établissement ou les services d’urgence."}
        </p>
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const b = new FormData(f);
            await send(
              b.get("kind") === "help"
                ? "/operations/portal/support"
                : "/operations/portal/messages",
              b.get("kind") === "help"
                ? { text: b.get("text") }
                : { text: b.get("text"), journey_id: journeyId },
            );
          }}
        >
          <label className="block text-sm">
            {ar ? "نوع الطلب" : "Votre demande"}
            <select name="kind" className={field}>
              <option value="help">
                {ar ? "طلب مساعدة" : "Demander de l’aide"}
              </option>
              <option value="reply">
                {ar ? "رسالة للفريق" : "Répondre à mon équipe"}
              </option>
            </select>
          </label>
          <label className="block text-sm">
            {ar
              ? "رسالة إدارية دون معلومات طبية"
              : "Votre message administratif, sans information médicale"}
            <textarea
              className={field}
              name="text"
              required
              maxLength={2000}
              rows={3}
            />
          </label>
          <Button size="patient" disabled={busy}>
            {ar ? "إرسال للفريق" : "Transmettre à mon équipe"}
          </Button>
        </form>
      </details>
      <details className="rounded-panel border border-line bg-white p-4">
        <summary className="cursor-pointer font-semibold">
          {ar ? "رسائلي الإدارية" : "Mes échanges administratifs"}
        </summary>
        <div className="mt-3 space-y-3">
          {j?.messages.map((m) => (
            <div className="rounded-card bg-surface-2 p-3" key={m.id}>
              <p className="text-sm">{m.body}</p>
              <p className="mt-2 text-meta text-ink-2">
                {m.status === "inbound_read"
                  ? ar
                    ? "قرأ الفريق رسالتكم"
                    : "Votre réponse a été traitée par l’équipe"
                  : m.status === "inbound"
                    ? ar
                      ? "رسالتكم وصلت إلى الفريق"
                      : "Votre réponse est reçue par l’équipe"
                    : m.status === "simulated"
                      ? ar
                        ? "محاكاة دون إرسال خارجي"
                        : "Simulation, aucun envoi externe"
                      : m.status === "delivered"
                        ? ar
                          ? "تم التسليم"
                          : "Livraison confirmée"
                        : ar
                          ? "متابعة من طرف الفريق"
                          : "Suivi par votre équipe"}
              </p>
            </div>
          ))}
          {!j?.messages.length && (
            <p className="text-sm text-ink-2">
              {ar ? "لا توجد رسائل بعد." : "Aucun échange pour le moment."}
            </p>
          )}
        </div>
      </details>
      <details className="rounded-panel border border-line bg-white p-4">
        <summary className="cursor-pointer font-semibold">
          {ar ? "التقدير الإداري للتكاليف" : "Mon estimation administrative"}
        </summary>
        {j?.finance.quote ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              {ar ? "التقدير المؤكد" : "Devis confirmé"} :{" "}
              {(j.finance.quote / 100).toFixed(2)} MAD
            </p>
            <p>
              {ar ? "الجزء التقديري للمريض" : "Part patient estimative"} :{" "}
              {(j.finance.estimated_patient_share / 100).toFixed(2)} MAD
            </p>
            <p>
              {ar ? "المبلغ التقديري المتبقي" : "Solde estimatif"} :{" "}
              {(j.finance.balance / 100).toFixed(2)} MAD
            </p>
            <p className="text-ink-2">
              {ar
                ? "تقدير يتحقق منه الفريق، وليس ضماناً للتغطية أو طلب دفع إلكتروني."
                : "Estimation vérifiée par votre équipe, sans garantie de couverture ni paiement en ligne."}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-2">
            {ar
              ? "لم يسجل الفريق تقديراً بعد."
              : "Votre équipe n’a pas encore enregistré d’estimation."}
          </p>
        )}
      </details>
      {!data.delegate && (
        <>
          <Card className="p-4">
            <h3 className="font-semibold">
              {ar ? "تفضيلات التذكير" : "Mes rappels administratifs"}
            </h3>
            <p className="mt-2 text-sm text-ink-2">
              {ar
                ? "يمكنكم إيقاف التذكيرات دون إغلاق ملفكم. تواصلوا مع المؤسسة لترتيب مرافقة بديلة."
                : "Vous pouvez arrêter les rappels sans fermer votre dossier. Votre établissement peut organiser un accompagnement adapté."}
            </p>
            <Button
              className="mt-3"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                send("/operations/portal/notifications", {
                  enabled: !data.notifications_enabled,
                })
              }
            >
              {data.notifications_enabled
                ? ar
                  ? "إيقاف التذكيرات"
                  : "Désactiver mes rappels"
                : ar
                  ? "تفعيل التذكيرات"
                  : "Réactiver mes rappels"}
            </Button>
          </Card>
          <details className="rounded-panel border border-line bg-white p-4">
            <summary className="cursor-pointer font-semibold">
              {ar ? "مراجعة معلومات الاتصال" : "Vérifier mes coordonnées"}
            </summary>
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(
                  "/operations/portal/profile",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
              }}
            >
              <label className="block text-sm">
                {ar ? "الهاتف" : "Téléphone"}
                <input
                  className={field}
                  name="phone"
                  type="tel"
                  dir="ltr"
                  defaultValue={data.profile.phone}
                />
              </label>
              <label className="block text-sm">
                {ar ? "البريد الإلكتروني" : "E-mail"}
                <input
                  className={field}
                  name="email"
                  type="email"
                  dir="ltr"
                  defaultValue={data.profile.email}
                />
              </label>
              <label className="block text-sm">
                {ar ? "اللغة" : "Langue"}
                <select
                  className={field}
                  name="language"
                  defaultValue={data.profile.language}
                >
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
              </label>
              <label className="block text-sm">
                {ar ? "قناة التواصل" : "Canal souhaité"}
                <select
                  className={field}
                  name="preferred_channel"
                  defaultValue={data.profile.preferred_channel}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="email">E-mail</option>
                </select>
              </label>
              <Button size="patient" disabled={busy}>
                {ar
                  ? "طلب مراجعة المعلومات"
                  : "Soumettre mes coordonnées à vérification"}
              </Button>
              <p className="text-meta text-ink-2">
                {ar
                  ? "لا تتغير معلوماتكم إلا بعد مراجعة الفريق."
                  : "Vos coordonnées changent après vérification par votre équipe."}
              </p>
            </form>
          </details>
          <details className="rounded-panel border border-line bg-white p-4">
            <summary className="cursor-pointer font-semibold">
              {ar
                ? "أحد أقاربي يساعدني"
                : "Un proche m’aide dans mes démarches"}
            </summary>
            <p className="mt-3 text-sm text-ink-2">
              {ar
                ? "صلاحية لمدة 72 ساعة، قابلة للإلغاء، دون مشاركة حسابكم أو حقوقكم الشخصية."
                : "Un accès de 72 h, révocable, sans partager votre compte ni vos droits personnels."}
            </p>
            <form
              className="mt-3 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await send(
                  "/operations/portal/delegations",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                if (r) setGrant({ link: String(r.link), code: String(r.code) });
              }}
            >
              <label className="text-sm">
                {ar ? "اسم المرافق" : "Nom de mon accompagnant"}
                <input
                  className={field}
                  name="label"
                  required
                  maxLength={100}
                />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" required className="mt-1" />
                {ar
                  ? "أسمح لهذا الشخص بالاطلاع على المعلومات الإدارية لمساراتي في هذه المؤسسة وإرسال الوثائق والرسائل."
                  : "J’autorise cette personne à consulter les informations administratives de mes parcours dans cet établissement et à transmettre des documents et messages."}
              </label>
              <Button size="patient" disabled={busy}>
                {ar ? "إنشاء صلاحية محدودة" : "Créer cet accès limité"}
              </Button>
            </form>
            {grant && (
              <div className="mt-3 rounded-card bg-warning-bg p-3 text-sm">
                <p>
                  {ar
                    ? "أرسلوا الرابط والرمز بشكل منفصل."
                    : "Transmettez le lien et le code séparément."}
                </p>
                <p className="mt-2 break-all select-all" dir="ltr">
                  {grant.link}
                </p>
                <strong className="mt-3 block select-all" dir="ltr">
                  {ar ? "الرمز" : "Code"} : {grant.code}
                </strong>
                <button
                  className="mt-2 underline"
                  onClick={() => setGrant(null)}
                >
                  {ar ? "إخفاء" : "Masquer"}
                </button>
              </div>
            )}
            <ul className="mt-3 space-y-3">
              {data.delegations.map((g) => (
                <li
                  key={g.id}
                  className="rounded-card border border-line p-3 text-sm"
                >
                  <p>
                    {g.label} ·{" "}
                    {g.revoked
                      ? ar
                        ? "ملغى"
                        : "Révoqué"
                      : new Date(g.expires_at) < new Date()
                        ? ar
                          ? "منتهي"
                          : "Expiré"
                        : ar
                          ? "نشط"
                          : "Actif"}
                  </p>
                  {!g.revoked && (
                    <Button
                      className="mt-2"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        send(
                          "/operations/portal/delegations/" + g.id,
                          {},
                          "DELETE",
                        )
                      }
                    >
                      {ar ? "إلغاء الصلاحية" : "Révoquer cet accès"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
