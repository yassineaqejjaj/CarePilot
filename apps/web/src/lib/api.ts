import { getToken } from "@/auth";

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const r = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<T>;
}
