// Centralized API Base URL configuration with auto-sanitization for Vercel/Railway deployments
const rawBase = import.meta.env.VITE_API_BASE;

export function getApiBase() {
  if (!rawBase || rawBase === "/api" || rawBase === "api") {
    return "/api";
  }
  let base = String(rawBase).trim();
  if (!base.startsWith("http://") && !base.startsWith("https://") && !base.startsWith("/")) {
    base = `https://${base}`;
  }
  // Ensure trailing /api is present if it is a host domain
  if (base.startsWith("http://") || base.startsWith("https://")) {
    if (!base.endsWith("/api") && !base.includes("/api/")) {
      base = `${base.replace(/\/+$/, '')}/api`;
    }
  }
  return base;
}

export const API_BASE = getApiBase();
export default API_BASE;
