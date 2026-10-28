import { getToken } from "@/auth";

export class ApiError extends Error {
  constructor(public status: number, public detail: string) { super(detail || String(status)); }
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const isForm = init.body instanceof FormData;  // le navigateur fixe lui-même le Content-Type multipart
  const r = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!r.ok) {
    let detail = "";
    try { const j = await r.json(); detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? ""); } catch { /* corps non JSON */ }
    throw new ApiError(r.status, detail);
  }
  return r;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  return (await raw(path, init)).json() as Promise<T>;
}

/** Télécharge un fichier protégé (jeton Bearer) et le propose à l'enregistrement. */
export async function download(path: string, fallbackName: string): Promise<void> {
  const r = await raw(path);
  const cd = r.headers.get("content-disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
