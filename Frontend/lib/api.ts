// lib/api.ts
const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

// Normalize API base so we don't accidentally concatenate malformed hosts.
// - If the value is a full URL (starts with http/https), strip trailing slash.
// - If it's empty or a single slash, treat as root ("") so calls become relative to current origin.
function normalizeBase(base: string) {
  if (!base || base === "/") return "";
  const trimmed = base.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, "");
  }
  // If the value looks like a hostname without protocol (e.g. example.com), prefer using https://
  if (/^[^/:]+(\:\d+)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  // Fallback: strip trailing slash
  return trimmed.replace(/\/$/, "");
}

export const API_BASE_URL = normalizeBase(rawBase);

// Simple in-memory cache for GET requests. Resets on page reload.
const getCache = new Map<string, { data: any; expiresAt: number }>();
const DEFAULT_TTL_MS = 60 * 1000; // 1 minute

function makeCacheKey(path: string, init?: RequestInit) {
  const headers = init?.headers ? JSON.stringify(init.headers) : "";
  return `${API_BASE_URL}${path}::${headers}`;
}

export async function apiGet(path: string, init?: RequestInit) {
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const res = await fetch(url, {
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
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const res = await fetch(url, {
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
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const res = await fetch(url, {
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
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const res = await fetch(url, {
    ...init,
    method: "DELETE",
    headers: {
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
