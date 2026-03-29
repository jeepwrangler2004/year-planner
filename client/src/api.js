// Centralized API base — points to Railway backend in production, localhost in dev
export const API_BASE = import.meta.env.VITE_BACKEND_URL || ''

export function apiUrl(path) {
  return `${API_BASE}${path}`
}
