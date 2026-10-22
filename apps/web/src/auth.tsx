import Keycloak from "keycloak-js";

// Connexion OIDC Authorization Code + PKCE via Keycloak. Aucune clé OpenAI ni secret côté navigateur.
const kc = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? "http://localhost:8080",
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? "carepilot",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT ?? "carepilot-web",
});

let ready: Promise<boolean> | null = null;
export const initAuth = () => (ready ??= kc.init({ onLoad: "login-required", pkceMethod: "S256", checkLoginIframe: false }));

export async function getToken(): Promise<string> {
  await initAuth();
  await kc.updateToken(30).catch(() => kc.login());
  return kc.token ?? "";
}

export const roles = (): string[] => (kc.tokenParsed as { realm_access?: { roles: string[] } } | undefined)?.realm_access?.roles ?? [];
export const username = () => (kc.tokenParsed as { preferred_username?: string } | undefined)?.preferred_username ?? "";
export const logout = () => kc.logout({ redirectUri: window.location.origin });
export const displayName = () => (kc.tokenParsed as { name?: string } | undefined)?.name ?? username();
