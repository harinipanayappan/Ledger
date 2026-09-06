const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request(path, { method = "GET", body, token } = {}) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body !== undefined) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (email, password) => request("/auth/register", { method: "POST", body: { email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),

  getInstruments: (token) => request("/instruments", { token }),

  getWatchlists: (token) => request("/watchlists", { token }),
  createWatchlist: (token, name) => request("/watchlists", { method: "POST", body: { name }, token }),
  renameWatchlist: (token, id, name) =>
    request(`/watchlists/${id}`, { method: "PATCH", body: { name }, token }),
  deleteWatchlist: (token, id) => request(`/watchlists/${id}`, { method: "DELETE", token }),

  getWatchlist: (token, id) => request(`/watchlists/${id}`, { token }),
  addItem: (token, watchlistId, instrumentId) =>
    request(`/watchlists/${watchlistId}/items`, {
      method: "POST",
      body: { instrument_id: instrumentId },
      token,
    }),
  removeItem: (token, watchlistId, itemId) =>
    request(`/watchlists/${watchlistId}/items/${itemId}`, { method: "DELETE", token }),
  markViewed: (token, watchlistId, instrumentId) =>
    request(`/watchlists/${watchlistId}/view`, {
      method: "POST",
      body: { instrument_id: instrumentId },
      token,
    }),

  killFeed: (token) => request("/admin/feed/kill", { method: "POST", token }),
  resumeFeed: (token) => request("/admin/feed/resume", { method: "POST", token }),
  feedStatus: (token) => request("/admin/feed/status", { token }),
};

export const BASE_URL_ROOT = BASE_URL.replace(/\/api$/, "");
