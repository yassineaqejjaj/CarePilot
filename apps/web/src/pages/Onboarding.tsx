import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileCheck2,
  HeartHandshake,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { tourKey } from "@/lib/onboarding";
import { Button, Card, Pill, Progress } from "@/components/ui";
import "./onboarding.css";

const steps = [
  {
    title: "Un parcours, une équipe",
    phase: "Vue d’ensemble",
    day: "J−21 → J+7",
    icon: HeartHandshake,
    heading: "Accompagnez Amal, du premier contact au suivi.",
    text: "Découvrez un parcours administratif de chirurgie ambulatoire. Vous pouvez avancer à votre rythme, activer la lecture automatique ou revenir sur une étape.",
    action:
      "Tout est illustré : aucun dossier n’est créé et aucun message n’est envoyé.",
    patient: "Amal · patiente fictive",
    items: [
      "Avant : préparer les démarches",
      "Le jour prévu : coordonner l’accueil",
      "Après : terminer le suivi administratif",
    ],
    outcome:
      "Un fil commun entre le patient, les admissions et la coordination.",
  },
  {
    title: "Choisir le parcours",
    phase: "Bibliothèque",
    day: "J−21",
    icon: ListChecks,
    heading: "Partez d’un modèle adapté à l’activité.",
    text: "Dans la bibliothèque, l’équipe choisit le modèle « Chirurgie ambulatoire ». Ses étapes et pièces attendues servent de base au dossier individuel.",
    action:
      "Les modèles publiés sont versionnés ; les dossiers existants gardent leur version.",
    patient: "Chirurgie ambulatoire · modèle de référence",
    items: [
      "Collecte des documents",
      "Suivi des démarches d’assurance",
      "Accueil et suivi administratif",
    ],
    outcome: "Les bonnes étapes, avec des échéances connues dès le départ.",
  },
  {
    title: "Créer le dossier",
    phase: "Dossiers patients",
    day: "J−21",
    icon: FileCheck2,
    heading: "Créez un dossier administratif clair.",
    text: "L’équipe renseigne l’identité, la date prévue et le parcours d’Amal. Les suggestions de doublons invitent à vérifier une identité existante avant de créer un nouveau patient.",
    action: "Seuls les éléments nécessaires à la coordination sont demandés.",
    patient: "Amal · nouveau dossier fictif",
    items: [
      "Identité et coordonnées à vérifier",
      "Date de prise en charge prévue",
      "Information du patient confirmée par l’équipe",
    ],
    outcome: "Un dossier individuel, lié au bon modèle de parcours.",
  },
  {
    title: "Attribuer la coordination",
    phase: "Coordination",
    day: "J−21",
    icon: Users,
    heading: "Chacun sait qui prend le relais.",
    text: "Un coordinateur et un service sont identifiés. Une transmission permet de garder le contexte lorsqu’un collègue reprend le dossier.",
    action:
      "Les droits d’accès et le périmètre de l’établissement continuent de s’appliquer.",
    patient: "Admissions → coordination",
    items: [
      "Responsable : coordinatrice de démonstration",
      "Service : admissions",
      "Transmission administrative tracée",
    ],
    outcome: "Une prochaine action et un responsable visibles par l’équipe.",
  },
  {
    title: "Inviter le patient",
    phase: "Communication",
    day: "J−20",
    icon: MessageSquare,
    heading: "Donnez à Amal un point d’entrée simple.",
    text: "Depuis le dossier, l’équipe prépare son lien d’accès personnel. Le patient confirme sa date de naissance, prend connaissance de la notice et choisit de poursuivre.",
    action:
      "L’invitation de cette visite est une illustration, pas un lien utilisable.",
    patient: "Invitation de démonstration",
    items: [
      "Accès personnel à durée limitée",
      "Vérification avant ouverture du portail",
      "Notice et consentement dans le parcours patient",
    ],
    outcome: "Un accès mobile simple, sans afficher de lien patient réel.",
  },
  {
    title: "Découvrir le portail",
    phase: "Espace patient",
    day: "J−20",
    icon: Smartphone,
    heading: "Une prochaine étape lisible sur téléphone.",
    text: "Le portail français/arabe présente à Amal ce qu’il reste à faire. Elle peut demander de l’aide et, si elle le souhaite, autoriser temporairement un proche.",
    action:
      "L’accès accompagnant est limité et révocable ; il ne remplace pas les choix du patient.",
    patient: "Bonjour Amal · aperçu du portail",
    items: [
      "Prochaine étape : transmettre une pièce",
      "Français / العربية",
      "Besoin d’aide ? Contacter l’équipe",
    ],
    outcome:
      "Le patient comprend sa prochaine démarche sans parcourir un long dossier.",
  },
  {
    title: "Recevoir les documents",
    phase: "Documents",
    day: "J−14",
    icon: FileCheck2,
    heading: "De la pièce attendue à la pièce reçue.",
    text: "Amal prévisualise le fichier avant de le déposer. L’équipe voit ensuite la pièce dans « Documents à vérifier », avec un état distinct de la validation.",
    action: "Recevoir un document ne signifie pas qu’il est validé.",
    patient: "Pièces administratives · exemple illustré",
    items: [
      "CIN ou passeport : reçu, à vérifier",
      "Attestation AMO : reçue, à vérifier",
      "Autre pièce attendue : à transmettre",
    ],
    outcome: "Les pièces reçues remontent directement dans la file de travail.",
  },
  {
    title: "Vérifier et accompagner",
    phase: "À traiter",
    day: "J−10",
    icon: ShieldCheck,
    heading: "L’équipe garde la décision de validation.",
    text: "Le coordinateur ouvre « Vérifier les pièces », contrôle le document puis le valide ou demande un remplacement avec une explication. Une aide à la lecture ne remplace pas ce contrôle.",
    action:
      "Les priorités affichées sont administratives ; elles ne constituent pas un triage médical.",
    patient: "Pièce reçue → contrôle humain",
    items: [
      "Vérifier la pièce et son contexte",
      "Valider ou demander une nouvelle pièce",
      "Expliquer au patient ce qui reste à faire",
    ],
    outcome:
      "Un statut compréhensible et un historique de la décision humaine.",
  },
  {
    title: "Suivre assurance et montants",
    phase: "Assurance / finances",
    day: "J−7",
    icon: Wallet,
    heading: "Gardez la visibilité sur les démarches.",
    text: "L’équipe suit la demande de prise en charge et enregistre les réponses qu’elle a vérifiées. Les devis, couvertures et acomptes externes peuvent être consignés en MAD.",
    action:
      "Aucun accord d’assurance, remboursement garanti ou paiement bancaire n’est produit par cette visite.",
    patient: "Suivi administratif · montants illustrés",
    items: [
      "Assurance : complément reçu, à vérifier",
      "Devis vérifié : 8 000 MAD",
      "Couverture enregistrée : 5 000 MAD",
    ],
    outcome:
      "Un suivi des faits vérifiés, avec une estimation administrative distincte d’un paiement.",
  },
  {
    title: "Préparer une relance",
    phase: "Automatisations",
    day: "J−3",
    icon: Sparkles,
    heading: "L’assistant prépare, le professionnel valide.",
    text: "Une pièce est encore attendue. Une proposition de relance est présentée à l’équipe : elle peut relire, modifier ou rejeter le message avant toute validation d’envoi.",
    action:
      "Dans cette visite, l’assistant et le message sont simulés. Aucune donnée n’est transmise à un modèle.",
    patient: "Brouillon de démonstration",
    items: [
      "Bonjour Amal, une étape administrative reste à compléter.",
      "Consultez votre espace ou contactez les admissions.",
      "Statut : validation humaine requise",
    ],
    outcome:
      "Des communications contrôlées, avec une distinction entre préparation et envoi.",
  },
  {
    title: "Coordonner l’accueil",
    phase: "Préparation et accueil",
    day: "J0",
    icon: Users,
    heading: "L’équipe partage un état administratif à jour.",
    text: "Les admissions consultent les pièces validées, les démarches en attente et la dernière transmission. L’arrivée peut être enregistrée sans transformer une pièce manquante en décision médicale.",
    action:
      "La plateforme ne décide ni de la prise en charge médicale ni d’un refus de soins.",
    patient: "Accueil prévu · dossier illustré",
    items: [
      "Pièces administratives : vérifiées",
      "Responsable et transmission : visibles",
      "Arrivée : enregistrée par un professionnel",
    ],
    outcome:
      "Une coordination fluide entre les équipes, au moment de l’accueil.",
  },
  {
    title: "Terminer le suivi",
    phase: "Après la prise en charge",
    day: "J+7",
    icon: HeartHandshake,
    heading: "Fermez la boucle administrative.",
    text: "L’équipe vérifie les dernières démarches, répond aux demandes encore ouvertes et clôture le dossier lorsque les règles administratives le permettent.",
    action:
      "Le suivi présenté ici ne collecte ni symptôme ni décision médicale.",
    patient: "Fin du parcours administratif",
    items: [
      "Dernières demandes d’aide traitées",
      "Documents et transmissions retrouvables",
      "Clôture administrative tracée",
    ],
    outcome: "Un parcours suivi jusqu’au bout, avec un historique consultable.",
  },
  {
    title: "Observer les résultats",
    phase: "Résultats du pilote",
    day: "Bilan",
    icon: LayoutDashboard,
    heading: "Vous avez fait le tour du parcours.",
    text: "La direction consulte la complétude et les échéances. Pour mesurer les gains, les équipes comparent des durées réellement observées avant et pendant le pilote, avec les effectifs disponibles.",
    action:
      "Cette visite ne génère aucune mesure ni économie fictive. Vous pouvez la revoir à tout moment dans Aide.",
    patient: "Votre prochaine étape",
    items: [
      "Explorer les modèles de parcours",
      "Ouvrir la file À traiter",
      "Tester séparément la démonstration interactive",
    ],
    outcome:
      "Une même plateforme pour accompagner le patient, organiser le travail et observer le pilote.",
  },
];

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [resume, setResume] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const manual = useRef(false);
  const step = steps[index],
    Icon = step.icon;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(tourKey()) ?? "null");
      if (
        Number.isInteger(saved?.step) &&
        saved.step > 0 &&
        saved.step < steps.length
      )
        setResume(saved.step);
    } catch {}
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!playing || reduced) return;
    const timer = window.setInterval(
      () =>
        setIndex((i) => {
          if (i === steps.length - 1) return i;
          return i + 1;
        }),
      8000,
    );
    return () => window.clearInterval(timer);
  }, [playing, reduced]);
  useEffect(() => {
    if (index === steps.length - 1) setPlaying(false);
    if (manual.current) {
      title.current?.focus({ preventScroll: true });
      manual.current = false;
    }
  }, [index]);
  function go(next: number) {
    setPlaying(false);
    manual.current = true;
    setIndex(Math.max(0, Math.min(next, steps.length - 1)));
  }
  useEffect(() => {
    if (index === 0) return;
    try {
      localStorage.setItem(
        tourKey(),
        JSON.stringify({ step: index, completed: index === steps.length - 1 }),
      );
    } catch {}
  }, [index]);
  function restart() {
    setPlaying(false);
    setResume(0);
    go(0);
    try {
      localStorage.setItem(
        tourKey(),
        JSON.stringify({ step: 0, completed: false }),
      );
    } catch {}
  }
  return (
    <div
      data-started={index > 0}
      className="space-y-5 tour"
      onKeyDown={(e) => {
        if (
          e.target instanceof HTMLElement &&
          ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
        )
          return;
        if (e.key === "Escape") setPlaying(false);
      }}
    >
      <div className="tour-intro flex flex-wrap items-start justify-between gap-3">
        <div>
          <Pill tone="mint">Visite guidée · 13 étapes · environ 4 minutes</Pill>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight">
            Un parcours complet, pas à pas.
          </h1>
          <p className="mt-2 max-w-3xl text-ink-2">
            Une illustration animée, indépendante de vos dossiers. Retrouvez
            cette visite à tout moment dans Aide.
          </p>
        </div>
        <Link
          aria-label="Quitter la visite"
          className="inline-flex min-h-11 items-center gap-2 rounded-ctl border border-line px-3 text-teal-700"
          to="/app"
        >
          <X size={16} />
          Quitter
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-white/80 p-3">
        <Button
          variant="secondary"
          onClick={() => {
            if (index === steps.length - 1) {
              restart();
              setPlaying(!reduced);
            } else setPlaying((v) => !v);
          }}
          disabled={reduced}
          aria-pressed={playing}
          aria-label={playing ? "Mettre en pause" : "Lecture automatique"}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
          <span className="hidden sm:inline">
            {playing ? "Mettre en pause" : "Lecture automatique"}
          </span>
          <span className="sm:hidden">
            {playing ? "Pause" : "Lecture auto"}
          </span>
        </Button>
        <Button variant="ghost" onClick={restart}>
          <RotateCcw size={16} />
          Recommencer
        </Button>
        {index === 0 && resume > 0 && (
          <Button variant="secondary" onClick={() => go(resume)}>
            Reprendre à l’étape {resume + 1}
          </Button>
        )}
        <p className="text-meta text-ink-2">
          {reduced
            ? "Animations réduites. Avancez à votre rythme."
            : "8 secondes par étape en lecture automatique. Mettez en pause pour lire ; Échap interrompt la lecture."}
        </p>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[260px_1fr]">
        <nav
          aria-label="Étapes de la visite"
          className="tour-steps flex gap-2 overflow-x-auto pb-2 xl:sticky xl:top-24 xl:flex-col xl:overflow-visible"
        >
          {steps.map((s, i) => (
            <button
              key={s.title}
              aria-current={index === i ? "step" : undefined}
              onClick={() => go(i)}
              className={`flex min-h-11 shrink-0 items-center gap-3 rounded-card border px-3 py-2 text-left text-sm ${index === i ? "border-teal-700 bg-mint-100 font-semibold text-teal-800" : "border-line bg-white/80 text-ink"}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs text-teal-700">
                {i < index ? <Check size={14} /> : i + 1}
              </span>
              {s.title}
            </button>
          ))}
        </nav>
        <section
          className="min-w-0 space-y-4"
          aria-label="Présentation du parcours"
        >
          <div className="flex items-center justify-between gap-3">
            <span role="status" className="font-semibold text-teal-700">
              Étape {index + 1} sur {steps.length} · {step.phase}
            </span>
            <Pill>{step.day}</Pill>
          </div>
          <Progress value={Math.round(((index + 1) / steps.length) * 100)} />
          <Card className="overflow-hidden">
            <div key={index} className="tour-scene">
              <div
                className="tour-illustration p-5 sm:p-7"
                aria-label="Illustration de démonstration"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-teal-800">
                    <Icon size={20} /> {step.phase}
                  </span>
                  <Pill tone="info">Simulation uniquement</Pill>
                </div>
                <div className="tour-example mx-auto mt-5 max-w-xl rounded-panel border border-white/90 bg-white/90 p-5 shadow-menu">
                  <p className="font-semibold text-navy-900">{step.patient}</p>
                  <ul className="mt-4 space-y-3">
                    {step.items.map((item, i) => (
                      <li
                        key={item}
                        style={{ animationDelay: `${i * 100}ms` }}
                        className="tour-item flex items-start gap-3 rounded-ctl border border-line bg-white p-3"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-100 text-teal-700">
                          {i + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="space-y-3 p-5 sm:p-7">
                <h2
                  ref={title}
                  tabIndex={-1}
                  className="text-xl font-semibold tracking-tight sm:text-2xl"
                >
                  {step.heading}
                </h2>
                <p className="max-w-3xl leading-relaxed text-ink-2">
                  {step.text}
                </p>
                <p className="rounded-card bg-mint-100 p-4 font-medium text-teal-800">
                  {step.outcome}
                </p>
                <p className="text-meta leading-relaxed text-ink-2">
                  {step.action}
                </p>
              </div>
            </div>
          </Card>
          <div className="tour-controls sticky bottom-[76px] z-10 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-white/95 p-3 shadow-menu lg:bottom-4">
            <Button
              variant="secondary"
              disabled={index === 0}
              onClick={() => go(index - 1)}
            >
              <ArrowLeft size={16} />
              Précédent
            </Button>
            {index < steps.length - 1 ? (
              <Button onClick={() => go(index + 1)}>
                Suivant
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Link
                to="/operations"
                className="inline-flex min-h-11 items-center gap-2 rounded-ctl bg-teal-700 px-4 font-semibold text-white"
              >
                Ouvrir À traiter
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
          {index === steps.length - 1 && (
            <Card className="p-5">
              <h3 className="font-semibold">Continuez dans votre espace</h3>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  className="min-h-11 rounded-ctl border px-4 py-3 font-semibold text-teal-700"
                  to="/modeles"
                >
                  Explorer les parcours
                </Link>
                <Link
                  className="min-h-11 rounded-ctl border px-4 py-3 font-semibold text-teal-700"
                  to="/demo"
                >
                  Tester la démo interactive
                </Link>
              </div>
              <p className="mt-3 text-meta text-ink-2">
                La démo interactive est distincte de cette visite : elle crée un
                dossier fictif lorsque vous choisissez de la lancer.
              </p>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
