/** Thin typed wrapper around the VOICEGUARD FastAPI backend.
 *
 * The base URL can be overridden with VITE_API_URL; it defaults to the
 * local backend used throughout the demo.
 */

// Backend URL resolution order:
//   1. /voiceguard-config.json ("apiUrl") — lets a deployed UI (e.g. Netlify)
//      point at a new backend WITHOUT rebuilding.
//   2. VITE_API_URL build-time environment variable.
//   3. Local default (127.0.0.1:8000).
let basePromise: Promise<string> | null = null;

function resolveApiBase(): Promise<string> {
  if (!basePromise) {
    basePromise = (async () => {
      try {
        const res = await fetch("/voiceguard-config.json", { cache: "no-store" });
        if (res.ok) {
          const cfg = (await res.json()) as { apiUrl?: string };
          if (cfg?.apiUrl) return cfg.apiUrl.replace(/\/+$/, "");
        }
      } catch {
        /* no config file — fall through */
      }
      return (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8000";
    })();
  }
  return basePromise;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

export interface AnalyzeSignals {
  speaker_match_pct: number | null;
  ai_voice_risk_pct: number | null;
  behavior_risk_pct: number | null;
}

export interface SpeakerPerVoice {
  name: string;
  similarity: number;
  match_pct: number;
}

export interface SpeakerMatchInfo {
  matched_name: string | null;
  match_pct: number | null;
  similarity: number | null;
  enrolled_count: number;
  per_voice: SpeakerPerVoice[];
  error: string | null;
}

export interface AiVoiceScore {
  label: string;
  score: number;
}

export interface AiVoiceInfo {
  model_risk_pct: number | null;
  heuristic_risk_pct: number | null;
  risk_pct: number | null;
  source: string;
  scores: AiVoiceScore[];
  features: Record<string, number | null>;
  error: string | null;
}

export interface BehaviorMatch {
  category: string;
  phrase: string;
  context: string;
}

export interface BehaviorInfo {
  risk_pct: number | null;
  matched: BehaviorMatch[];
  categories_hit: string[];
  matched_count: number;
  transcript_empty?: boolean;
  error?: string | null;
}

export interface EnrollResponse {
  enrollment_id: number;
  name: string;
  dimensions: number;
  audio_file: string;
  message: string;
}

export interface EnrolledVoice {
  id: number;
  name: string;
  created_at: string;
}

export interface AnalyzeResponse {
  analysis_id: number | null;
  status: string;
  audio: { filename: string; duration_sec: number | null };
  transcript: string | null;
  language: string | null;
  signals: AnalyzeSignals;
  speaker: SpeakerMatchInfo | null;
  ai_voice: AiVoiceInfo | null;
  behavior: BehaviorInfo | null;
  risk_components: { base: number; ai_term: number; behavior_term: number };
  overall_risk_pct: number | null;
  decision: string;
  reasons: string[];
  pipeline_status: Record<string, string>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBase = await resolveApiBase();
  const res = await fetch(`${apiBase}${path}`, init);
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* non-JSON error body — keep the status code */
    }
    throw new Error(`Backend error ${detail} on ${path}`);
  }
  return (await res.json()) as T;
}

/** GET /health — liveness probe (Phase 1). */
export function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

/** POST /analyze — multipart audio intake (Phase 2; ML signals land in Phases 3-7). */
export function analyzeAudio(file: File): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("file", file);
  return request<AnalyzeResponse>("/analyze", { method: "POST", body: form });
}

/** POST /enroll — register a reference voice (Phase 4). */
export function enrollVoice(name: string, file: File): Promise<EnrollResponse> {
  const form = new FormData();
  form.append("name", name);
  form.append("file", file);
  return request<EnrollResponse>("/enroll", { method: "POST", body: form });
}

/** GET /enroll — list enrolled reference voices (Phase 4). */
export function listEnrolled(): Promise<EnrolledVoice[]> {
  return request<EnrolledVoice[]>("/enroll");
}

// Phase 5 adds the AI-voice detection wiring server-side; no client change needed.
