import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { tourKey } from "@/lib/onboarding";
export default function OnboardingInvite() {
  const location = useLocation();
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem(tourKey());
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      setVisible(!localStorage.getItem(tourKey()));
    } catch {
      setVisible(false);
    }
  }, [location.pathname]);
  if (!visible || location.pathname === "/visite-guidee") return null;
  return (
    <aside
      className="mb-5 flex flex-wrap items-center gap-3 rounded-panel border border-teal-700/20 bg-mint-100 p-4"
      aria-label="Découvrir M3aya Santé"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-teal-800">
          Premiers pas avec M3aya Santé
        </p>
        <p className="mt-1 text-sm text-teal-800">
          Découvrez un parcours complet, du dossier au suivi, dans une visite
          animée et sans modifier vos données.
        </p>
      </div>
      <Link
        to="/visite-guidee"
        className="inline-flex min-h-11 items-center rounded-ctl bg-teal-700 px-4 font-semibold text-white"
      >
        Commencer la visite
      </Link>
      <button
        className="min-h-11 rounded-ctl px-3 text-teal-800"
        onClick={() => {
          try {
            localStorage.setItem(
              tourKey(),
              JSON.stringify({ step: 0, dismissed: true }),
            );
          } catch {}
          setVisible(false);
        }}
      >
        Plus tard
      </button>
    </aside>
  );
}
