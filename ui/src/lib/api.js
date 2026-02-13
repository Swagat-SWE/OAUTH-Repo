async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  // Not logged in is not an exception
  if (res.status === 401) return { ok: false, status: 401, data: null };

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "API request failed");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { ok: true, status: res.status, data };
}

export const api = {
  status() {
    return apiFetch("/status.json");
  },
  events() {
    return apiFetch("/events");
  },
};
