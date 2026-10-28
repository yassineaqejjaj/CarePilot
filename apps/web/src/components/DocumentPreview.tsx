import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
export default function DocumentPreview({
  file,
  lang,
  onCancel,
  onConfirm,
}: {
  file: File;
  lang: "fr" | "ar";
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(file),
    [url, setUrl] = useState(""),
    [small, setSmall] = useState(false),
    [feedback, setFeedback] = useState("");
  const image = useRef<HTMLImageElement>(null);
  const ar = lang === "ar";
  useEffect(() => {
    const u = URL.createObjectURL(selected);
    setUrl(u);
    ref.current?.showModal();
    return () => URL.revokeObjectURL(u);
  }, [selected]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-32px)] max-w-md overflow-auto glass-sheet rounded-panel p-5 backdrop:bg-navy-900/50"
      dir={ar ? "rtl" : "ltr"}
    >
      <h2 className="text-xl font-semibold">
        {ar ? "تحققوا قبل الإرسال" : "Vérifiez avant de transmettre"}
      </h2>
      <p className="mt-3 text-sm text-ink-2">
        {ar
          ? "تأكدوا من ظهور الوثيقة كاملة ووضوح النص. يمكنكم إعادة الصورة. لا توجد مصادقة تلقائية على المحتوى."
          : "La pièce doit être entière, bien éclairée et lisible. Vous pouvez reprendre la photo. Aucune validation automatique du contenu."}
      </p>
      {selected.type.startsWith("image/") ? (
        <img
          ref={image}
          className="mt-4 max-h-[45dvh] w-full rounded-card object-contain"
          src={url}
          alt={
            ar ? "معاينة الوثيقة المختارة" : "Aperçu du document sélectionné"
          }
          onLoad={(e) => {
            const im = e.currentTarget;
            setSmall(im.naturalWidth < 500 || im.naturalHeight < 500);
          }}
        />
      ) : (
        <p className="mt-4 rounded-card bg-surface-2 p-4 break-all">
          {selected.name}
        </p>
      )}
      {small && (
        <p className="mt-3 text-sm text-warning-text">
          {ar
            ? "قد تكون الصورة صغيرة جداً. تحققوا من إمكانية قراءتها."
            : "La résolution semble faible. Vérifiez que le texte est lisible."}
        </p>
      )}
      <p className="mt-3 text-meta text-ink-2">
        {(selected.size / 1024 / 1024).toFixed(1)} Mo ·{" "}
        {ar ? "الحد الأقصى 10 ميغابايت" : "10 Mo maximum"}
      </p>
      {selected.type.startsWith("image/") && (
        <Button
          className="mt-3 w-full"
          variant="secondary"
          onClick={() => {
            const im = image.current;
            if (!im?.naturalWidth) return;
            try {
              const canvas = document.createElement("canvas");
              const scale = Math.min(
                1,
                1600 / Math.max(im.naturalWidth, im.naturalHeight),
              );
              canvas.width = Math.round(im.naturalWidth * scale);
              canvas.height = Math.round(im.naturalHeight * scale);
              const ctx = canvas.getContext("2d");
              if (!ctx) return;
              ctx.fillStyle = "white";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
              canvas.toBlob(
                (blob) => {
                  if (blob && blob.size < selected.size) {
                    setSelected(
                      new File(
                        [blob],
                        selected.name.replace(/\.[^.]+$/, "") + "-leger.jpg",
                        { type: "image/jpeg" },
                      ),
                    );
                    setFeedback(
                      ar
                        ? "تم تقليل الحجم على هاتفكم. تحققوا من وضوح الصورة."
                        : "Image allégée sur votre appareil. Vérifiez qu’elle reste lisible.",
                    );
                  } else
                    setFeedback(
                      ar
                        ? "لم يكن من الضروري تقليل الحجم."
                        : "L’image est déjà légère ; le fichier original est conservé.",
                    );
                },
                "image/jpeg",
                0.82,
              );
            } catch {
              setFeedback(
                ar
                  ? "احتفظوا بالصورة الأصلية."
                  : "Le fichier original est conservé.",
              );
            }
          }}
        >
          {ar
            ? "تقليل حجم الصورة لاتصال بطيء"
            : "Alléger l’image pour une connexion lente"}
        </Button>
      )}
      {feedback && (
        <p role="status" className="mt-2 text-sm text-ink-2">
          {feedback}
        </p>
      )}
      <div className="mt-4 space-y-2">
        <Button
          size="patient"
          disabled={selected.size > 10 * 1024 * 1024}
          onClick={() => onConfirm(selected)}
        >
          {ar ? "تأكيد الإرسال" : "Confirmer la transmission"}
        </Button>
        <Button size="patient" variant="secondary" onClick={onCancel}>
          {ar ? "اختيار وثيقة أخرى" : "Choisir une autre photo ou pièce"}
        </Button>
      </div>
    </dialog>
  );
}
