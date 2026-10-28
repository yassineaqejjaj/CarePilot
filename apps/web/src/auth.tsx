import Keycloak from "keycloak-js";

// Connexion OIDC Authorization Code + PKCE via Keycloak. Aucune clé OpenAI ni secret côté navigateur.
const kc = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? "http://localhost:8080",
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? "carepilot",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT ?? "carepilot-web",
});

const requestedLocale = new URLSearchParams(window.location.search).get("lang");
const locale = requestedLocale === "ar" || requestedLocale === "fr" ? requestedLocale : undefined;
let ready: Promise<boolean> | null = null;
export const initAuth = () => (ready ??= kc.init({ onLoad: "login-required", pkceMethod: "S256", checkLoginIframe: false, locale }));

// Session patient (lien sécurisé) : jeton court gardé en sessionStorage, jamais en localStorage.
const KEY = "cp_patient_session";
export type PatientSession = { access_token: string; exp: number; first_name: string; language: string };
export function patientSession(): PatientSession | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as PatientSession | null;
    return s && s.exp > Date.now() ? s : null;
  } catch { return null; }
}
export const setPatientSession = (r: { access_token: string; expires_in: number; first_name: string; language: string }) =>
  sessionStorage.setItem(KEY, JSON.stringify({ access_token: r.access_token, exp: Date.now() + r.expires_in * 1000 - 60_000, first_name: r.first_name, language: r.language }));

export async function getToken(): Promise<string> {
  const ps = patientSession();
  if (ps) return ps.access_token;
  await initAuth();
  await kc.updateToken(30).catch(() => kc.login());
  return kc.token ?? "";
}

export const roles = (): string[] => patientSession() ? ["patient"] : (kc.tokenParsed as { realm_access?: { roles: string[] } } | undefined)?.realm_access?.roles ?? [];
export const username = () => patientSession()?.first_name ?? (kc.tokenParsed as { preferred_username?: string } | undefined)?.preferred_username ?? "";
export const logout = () => {
  if (patientSession()) { sessionStorage.removeItem(KEY); window.location.href = "/"; return; }
  return kc.logout({ redirectUri: window.location.origin });
};
export const displayName = () => patientSession()?.first_name ?? (kc.tokenParsed as { name?: string } | undefined)?.name ?? username();
