import { createContext, useContext, useEffect, useState } from "react";

type Preferences = {
  compact: boolean;
  collapsed: boolean;
  hideTechnical: boolean;
};
const defaults: Preferences = {
  compact: false,
  collapsed: false,
  hideTechnical: false,
};
const Context = createContext({
  ...defaults,
  update: (_patch: Partial<Preferences>) => {},
});
export function DisplayProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<Preferences>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("m3aya-display") ?? "{}");
      return {
        compact: saved.compact === true,
        collapsed: saved.collapsed === true,
        hideTechnical: saved.hideTechnical === true,
      };
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("m3aya-display", JSON.stringify(value));
    } catch {
      /* Preferences are optional. */
    }
  }, [value]);
  return (
    <Context.Provider
      value={{
        ...value,
        update: (patch) => setValue((old) => ({ ...old, ...patch })),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useDisplay = () => useContext(Context);
export const technicalExample = (name: string) =>
  /\btest\b|\bfictif\s+\d{6,}/i.test(name);
export function DisplayControls() {
  const p = useDisplay();
  return (
    <details className="relative">
      <summary className="cursor-pointer rounded-ctl border border-line bg-white px-3 py-2 text-sm font-semibold">
        Affichage
      </summary>
      <div className="glass-sheet absolute right-0 top-full z-30 mt-2 w-72 space-y-3 rounded-panel border p-4 shadow-menu">
        <p className="font-semibold">Mon espace de travail</p>
        {(
          [
            ["compact", "Densité compacte"],
            ["collapsed", "Réduire le menu"],
            ["hideTechnical", "Masquer les tests techniques (démo)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={p[key]}
              onChange={(e) => p.update({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        <p className="text-meta text-ink-2">
          Réglages sur cet appareil. Masquer les tests filtre les listes ; aucun
          dossier n’est supprimé.
        </p>
      </div>
    </details>
  );
}
