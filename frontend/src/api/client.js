/**
 * API Client
 * ----------
 * This module provides a small fetch wrapper for making JSON HTTP requests to the backend.
 *
 * What it does:
 * - Uses a configurable API base URL and appends request paths to it.
 * - Sends JSON by default and merges any caller provided headers.
 * - Parses responses as JSON when possible, otherwise returns raw text.
 * - Throws an Error for non 2xx responses with a helpful message when the server provides one.
 *
 * Exports:
 * - api.get: Performs a GET request for a given path.
 * - api.post: Performs a POST request for a given path with an optional JSON body.
 */

const API_BASE = process.env.REACT_APP_API_BASE_URL;

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
};
