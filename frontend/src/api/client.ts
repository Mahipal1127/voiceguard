/** Thin typed wrapper around the VOICEGUARD FastAPI backend.
 *
 * The base URL can be overridden with VITE_API_URL (see .env.example once
 * added); it defaults to the local backend used throughout the demo.
 */

const API_BASE: string = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    throw new Error(`Backend error ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

/** GET /health — liveness probe (Phase 1). */
export function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

// Phase 2 adds analyzeAudio(file) here; Phase 4 adds enrollVoice(...).
