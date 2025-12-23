const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string) || "http://127.0.0.1:8000";

export function toAbsUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}
