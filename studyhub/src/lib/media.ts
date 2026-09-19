// Pure parsing helpers for material links and durations. Used by server validation and client forms.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

/** Extracts the 11-character video id from any common YouTube URL, or null. */
export function parseYouTubeId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    const [, kind, second] = url.pathname.split("/");
    if (kind === "watch") id = url.searchParams.get("v");
    else if (kind === "embed" || kind === "shorts" || kind === "live" || kind === "v") id = second ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const youtubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0`;

/** Only plain http(s) links with a host and no embedded credentials. Rejects javascript:, data:, file:, etc. */
export function safeExternalUrl(input: string): string | null {
  if (input.length > 2000) return null;
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || !url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** "24:15" -> 1455, "1:02:03" -> 3723, "90" -> 5400 (a bare number means minutes). Returns null when invalid. */
export function parseDuration(input: string): number | null {
  const v = input.trim();
  if (/^\d{1,4}$/.test(v)) return Number(v) * 60 <= 86_400 ? Number(v) * 60 : null;
  const m = /^(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)$/.exec(v);
  if (!m) return null;
  const seconds = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return seconds > 0 && seconds <= 86_400 ? seconds : null;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
