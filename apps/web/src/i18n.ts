import { useCallback, useEffect, useState } from "react";
import { patientSession } from "@/auth";

/** Espace patient bilingue (français / arabe, RTL). Le back-office reste en français.
 *  Les textes arabes sont en arabe standard : à faire relire par un locuteur natif avant mise en service. */
export type Lang = "fr" | "ar";

const fr = {
  "entry.title": "Accédez à votre espace patient",
  "entry.text": "Pour votre sécurité, confirmez votre date de naissance.",
  "entry.birth": "Date de naissance (JJ/MM/AAAA)",
  "entry.go": "Continuer",
  "entry.error": "Lien invalide, expiré, ou date de naissance incorrecte.",
  "entry.wait": "Vérification…",
  "greeting": "Bonjour {name}, voici les prochaines étapes de votre parcours.",
  "todo.before": "À faire avant le {date}",
  "todo.deposit": "Déposez : {item}",
  "todo.complete": "Complétez : {item}",
  "todo.help": "Une photo nette suffit. Elle permet de finaliser votre dossier d'admission.",
  "todo.photo": "Prendre une photo ou choisir un fichier",
  "todo.done": "Marquer comme complété",
  "todo.sending": "Envoi en cours…",
  "alldone.title": "Tout est à jour",
  "alldone.text": "Vous n'avez rien à faire pour le moment.",
  "prep.title": "Votre préparation",
  "prep.steps": "{done} sur {total} étapes",
  "prep.surgery": "Intervention le {date} · arrivée à {time}",
  "tasks.title": "Mes tâches",
  "status.todo": "À faire", "status.submitted": "En revue", "status.done": "Fait", "status.soon": "Bientôt",
  "tasks.validated": "Validé", "tasks.before": "Avant le {date}", "tasks.available": "Disponible le {date}",
  "dates.title": "Dates importantes",
  "dates.practical": "Vous recevrez vos informations pratiques (accès, horaires, documents à apporter).",
  "dates.admission": "Admission à {time} — accueil du service ambulatoire.",
  "help.title": "Une question administrative ?",
  "help.hours": "Service des admissions, du lundi au vendredi de 8:30 à 18:00.",
  "help.call": "Appeler", "help.write": "Écrire", "help.demo": "Démo : aucun appel ni e-mail réel dans cette démonstration.",
  "disclaimer": "Pour toute question médicale, contactez directement votre chirurgien. En cas d'urgence, appelez le 15 ou le 141 (SAMU). N'indiquez aucune information médicale dans cet espace.",
  "tab.home": "Accueil", "tab.tasks": "Tâches", "tab.journey": "Parcours", "tab.messages": "Messages", "tab.rights": "Mes droits",
  "messages.title": "Messages", "messages.none": "Aucun message pour le moment.",
  "sent.title": "Merci, c'est envoyé", "sent.text": "Votre équipe va vérifier votre document.",
  "err.type": "Format non accepté (PDF, JPEG, PNG).", "err.size": "Fichier trop volumineux (10 Mo maximum).", "err.generic": "Une erreur est survenue, réessayez.",
  "consent.title": "Vos données personnelles",
  "consent.intro": "Avant de commencer, voici comment la clinique utilise vos informations (loi n° 09-08).",
  "consent.controller": "Responsable du traitement", "consent.purpose": "Finalité", "consent.data": "Données traitées", "consent.recipients": "Destinataires",
  "consent.retention": "Conservation", "consent.rights": "Vos droits", "consent.cndp": "Autorisation CNDP",
  "consent.purpose.v": "Suivi administratif de votre parcours avant et après votre intervention (documents, rendez-vous, rappels). Aucune information médicale n'est demandée.",
  "consent.data.v": "Identité, coordonnées, date de naissance et pièces administratives que vous déposez.",
  "consent.recipients.v": "Le personnel habilité de la clinique et ses prestataires techniques (hébergement, messagerie), tenus à la confidentialité.",
  "consent.retention.v": "{days} jours après la clôture de votre parcours, puis suppression ou anonymisation.",
  "consent.rights.v": "Accès, rectification et opposition. Contact : {contact}.",
  "consent.cndp.none": "Référence non renseignée (environnement de démonstration).",
  "consent.accept": "J'ai lu et j'accepte", "consent.refuse": "Je refuse",
  "consent.refused": "Sans votre accord, veuillez contacter directement le service des admissions.",
  "rights.title": "Mes données et mes droits",
  "rights.export": "Télécharger mes données",
  "rights.rectification": "Demander une rectification", "rights.opposition": "M'opposer au traitement", "rights.deletion": "Demander l'effacement",
  "rights.message": "Précisez votre demande (facultatif)", "rights.send": "Envoyer la demande", "rights.sent": "Votre demande a été transmise à la clinique.",
  "logout": "Quitter",
};

const ar: Record<keyof typeof fr, string> = {
  "entry.title": "الدخول إلى فضاء المريض",
  "entry.text": "لحمايتكم، يرجى تأكيد تاريخ ميلادكم.",
  "entry.birth": "تاريخ الميلاد (يوم/شهر/سنة)",
  "entry.go": "متابعة",
  "entry.error": "الرابط غير صالح أو منتهي الصلاحية، أو تاريخ الميلاد غير صحيح.",
  "entry.wait": "جارٍ التحقق…",
  "greeting": "مرحباً {name}، إليكم المراحل القادمة من مساركم.",
  "todo.before": "للإنجاز قبل {date}",
  "todo.deposit": "أرسلوا: {item}",
  "todo.complete": "أكملوا: {item}",
  "todo.help": "تكفي صورة واضحة. فهي تتيح إتمام ملف قبولكم.",
  "todo.photo": "التقاط صورة أو اختيار ملف",
  "todo.done": "تأكيد الإنجاز",
  "todo.sending": "جارٍ الإرسال…",
  "alldone.title": "كل شيء محدَّث",
  "alldone.text": "لا شيء مطلوب منكم حالياً.",
  "prep.title": "تحضيراتكم",
  "prep.steps": "{done} من {total} مراحل",
  "prep.surgery": "العملية يوم {date} · الحضور على الساعة {time}",
  "tasks.title": "مهامي",
  "status.todo": "للإنجاز", "status.submitted": "قيد المراجعة", "status.done": "تم", "status.soon": "قريباً",
  "tasks.validated": "تم التحقق", "tasks.before": "قبل {date}", "tasks.available": "متاح يوم {date}",
  "dates.title": "تواريخ مهمة",
  "dates.practical": "ستصلكم المعلومات العملية (الولوج، المواعيد، الوثائق الواجب إحضارها).",
  "dates.admission": "الاستقبال على الساعة {time} — مصلحة الجراحة بدون مبيت.",
  "help.title": "سؤال إداري؟",
  "help.hours": "مصلحة القبول، من الاثنين إلى الجمعة، من 8:30 إلى 18:00.",
  "help.call": "اتصال", "help.write": "مراسلة", "help.demo": "نسخة تجريبية: لا يتم أي اتصال أو إرسال بريد فعلي.",
  "disclaimer": "لأي سؤال طبي، اتصلوا مباشرة بجراحكم. في حالة الاستعجال، اتصلوا بالرقم 15 أو 141 (سامو). لا تدخلوا أي معلومات طبية في هذا الفضاء.",
  "tab.home": "الرئيسية", "tab.tasks": "المهام", "tab.journey": "المسار", "tab.messages": "الرسائل", "tab.rights": "حقوقي",
  "messages.title": "الرسائل", "messages.none": "لا توجد رسائل حالياً.",
  "sent.title": "شكراً، تم الإرسال", "sent.text": "سيتحقق فريقنا من وثيقتكم.",
  "err.type": "صيغة غير مقبولة (PDF أو JPEG أو PNG).", "err.size": "الملف كبير جداً (10 ميغابايت كحد أقصى).", "err.generic": "حدث خطأ، يرجى المحاولة من جديد.",
  "consent.title": "بياناتكم الشخصية",
  "consent.intro": "قبل البدء، إليكم كيف تستعمل المصحة معلوماتكم (القانون رقم 09-08).",
  "consent.controller": "المسؤول عن المعالجة", "consent.purpose": "الغاية", "consent.data": "المعطيات المعالجة", "consent.recipients": "المرسَل إليهم",
  "consent.retention": "مدة الحفظ", "consent.rights": "حقوقكم", "consent.cndp": "ترخيص اللجنة الوطنية (CNDP)",
  "consent.purpose.v": "المتابعة الإدارية لمساركم قبل العملية وبعدها (وثائق، مواعيد، تذكيرات). لا يُطلب أي معطى طبي.",
  "consent.data.v": "الهوية، بيانات الاتصال، تاريخ الميلاد، والوثائق الإدارية التي ترسلونها.",
  "consent.recipients.v": "المستخدمون المخوَّلون بالمصحة ومزوّدوها التقنيون (الاستضافة، المراسلة) الملزمون بالسرية.",
  "consent.retention.v": "{days} يوماً بعد إغلاق مساركم، ثم الحذف أو إخفاء الهوية.",
  "consent.rights.v": "الولوج والتصحيح والتعرّض. للتواصل: {contact}.",
  "consent.cndp.none": "المرجع غير مُدخل (بيئة تجريبية).",
  "consent.accept": "اطلعتُ وأوافق", "consent.refuse": "أرفض",
  "consent.refused": "دون موافقتكم، يرجى الاتصال مباشرة بمصلحة القبول.",
  "rights.title": "بياناتي وحقوقي",
  "rights.export": "تنزيل بياناتي",
  "rights.rectification": "طلب تصحيح", "rights.opposition": "التعرّض على المعالجة", "rights.deletion": "طلب المحو",
  "rights.message": "وضّحوا طلبكم (اختياري)", "rights.send": "إرسال الطلب", "rights.sent": "تم إرسال طلبكم إلى المصحة.",
  "logout": "خروج",
};

const DICT = { fr, ar };
export type Key = keyof typeof fr;

/** Intitulés d'étapes en arabe (les modèles de parcours sont saisis en français). */
const TITLES_AR: Record<string, string> = {
  "CIN ou passeport": "بطاقة التعريف الوطنية أو جواز السفر",
  "Attestation AMO (CNSS / CNOPS)": "شهادة التأمين الإجباري عن المرض (CNSS / CNOPS)",
  "Questionnaire d'admission": "استمارة القبول",
  "Prise en charge mutuelle / assurance": "التكفل من طرف التعاضدية / شركة التأمين",
  "Consentement administratif signé": "الموافقة الإدارية الموقعة",
  "Informations pratiques": "معلومات عملية",
  "Questionnaire de satisfaction": "استمارة الرضا",
};
export const taskTitle = (lang: Lang, title: string) => (lang === "ar" ? TITLES_AR[title] ?? title : title);

export function translate(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), DICT[lang][key]);
}

const LS = "cp_lang";
export function useLang(initial?: Lang): [Lang, (l: Lang) => void, (k: Key, v?: Record<string, string | number>) => string] {
  const [lang, setLangState] = useState<Lang>(() => {
    try { const s = localStorage.getItem(LS); if (s === "fr" || s === "ar") return s; } catch { /* stockage indisponible */ }
    const l = (initial ?? patientSession()?.language) as Lang | undefined;
    return l === "ar" ? "ar" : "fr";
  });
  const setLang = useCallback((l: Lang) => { setLangState(l); try { localStorage.setItem(LS, l); } catch { /* ignoré */ } }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    return () => { document.documentElement.dir = "ltr"; document.documentElement.lang = "fr"; };
  }, [lang]);
  const t = useCallback((k: Key, v?: Record<string, string | number>) => translate(lang, k, v), [lang]);
  return [lang, setLang, t];
}
