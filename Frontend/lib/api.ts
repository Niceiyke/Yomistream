// lib/api.ts
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

// Simple in-memory cache for GET requests. Resets on page reload.
const getCache = new Map<string, { data: any; expiresAt: number }>();
const DEFAULT_TTL_MS = 60 * 1000; // 1 minute

function makeCacheKey(path: string, init?: RequestInit) {
  const headers = init?.headers ? JSON.stringify(init.headers) : "";
  return `${API_BASE_URL}${path}::${headers}`;
}

export async function apiGet(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    method: "GET",
    headers: {
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiGetCached(path: string, init?: RequestInit, ttlMs: number = DEFAULT_TTL_MS) {
  const key = makeCacheKey(path, init);
  const now = Date.now();
  const cached = getCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const data = await apiGet(path, init);
  getCache.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

export function clearGetCache(prefix?: string) {
  if (!prefix) {
    getCache.clear();
    return;
  }
  for (const key of Array.from(getCache.keys())) {
    if (key.includes(prefix)) getCache.delete(key);
  }
}

export async function apiPost(path: string, body: any, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPut(path: string, body: any, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDelete(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    method: "DELETE",
    headers: {
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
