/**
 * Central API config and auth helpers.
 * Use getApiBase() and getAuthHeaders() for all backend requests.
 * On 401, call clearSessionAndRedirect() so token/user are cleared and user is sent to login.
 */
const TOKEN_KEY = 'melodia_token';
const LEGACY_TOKEN_KEY = 'token';

function getApiBase() {
  const raw = import.meta.env.VITE_API_URL || '';
  const base = raw.replace(/\/$/, '');
  // Empty = same-origin: use current origin so relative URLs work and !base checks pass
  return base || (typeof window !== 'undefined' ? window.location.origin : '');
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || '';
}

function getAuthHeaders() {
  const token = getToken();
  const headers = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Clear token and user from storage. Call this on 401 (and optionally redirect to /auth).
 * User store must be cleared by the caller (e.g. userStore.clearUser()) so the navbar updates.
 */
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem('melodia_user');
}

/**
 * Clear session and redirect to auth page. Use after 401 so the app doesn't stay in a broken state.
 */
function clearSessionAndRedirect() {
  clearSession();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const path = '/auth';
  if (typeof window !== 'undefined') {
    window.location.href = `${origin}${path}`;
  }
}

/**
 * Fetch with base URL, auth headers, and optional 401 handling.
 * If options.handle401 !== false and response status is 401, clears session and redirects to /auth.
 */
async function apiFetch(path, options = {}) {
  const base = getApiBase();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && options.handle401 !== false) {
    clearSessionAndRedirect();
    throw new Error('Unauthorized');
  }
  return res;
}

export {
  getApiBase,
  getToken,
  getAuthHeaders,
  clearSession,
  clearSessionAndRedirect,
  apiFetch,
  TOKEN_KEY,
  LEGACY_TOKEN_KEY,
};
