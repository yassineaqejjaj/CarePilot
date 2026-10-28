"""Modèles de messages APPROUVÉS (fr/ar). Texte administratif uniquement : aucune information médicale,
aucun contenu promotionnel (la prospection par SMS/e-mail relève de l'art. 10 de la loi 09-08)."""
from __future__ import annotations

TEMPLATES = {
    "missing_document": {
        "fr": {"subject": "Document à nous transmettre",
               "body": ("Bonjour {first_name},\n\nPour finaliser votre dossier d'admission du {date}, il nous manque : {document}. "
                        "Vous pouvez le déposer en photo depuis votre espace patient.\n\nMerci,\nLe service des admissions — {clinic}")},
        "ar": {"subject": "وثيقة مطلوبة",
               "body": ("مرحباً {first_name}،\n\nلإكمال ملف قبولكم بتاريخ {date}، ينقصنا: {document}. "
                        "يمكنكم إرسال صورة منها عبر فضاء المريض.\n\nشكراً،\nمصلحة القبول — {clinic}")},
    },
    "invitation": {
        "fr": {"subject": "Votre espace patient",
               "body": ("Bonjour {first_name},\n\n{clinic} vous invite à suivre vos démarches administratives avant votre intervention du {date}. "
                        "Ouvrez ce lien personnel (valable {hours} h) : {link}\nVous devrez confirmer votre date de naissance.\n\n"
                        "Ne partagez pas ce lien.")},
        "ar": {"subject": "فضاء المريض الخاص بكم",
               "body": ("مرحباً {first_name}،\n\nتدعوكم {clinic} لمتابعة الإجراءات الإدارية قبل عمليتكم بتاريخ {date}. "
                        "افتحوا هذا الرابط الشخصي (صالح لمدة {hours} ساعة): {link}\nسيُطلب منكم تأكيد تاريخ الميلاد.\n\n"
                        "لا تشاركوا هذا الرابط.")},
    },
}


def render(kind: str, lang: str, **vars) -> dict:
    t = TEMPLATES[kind].get(lang) or TEMPLATES[kind]["fr"]
    return {"subject": t["subject"], "body": t["body"].format(**vars)}
