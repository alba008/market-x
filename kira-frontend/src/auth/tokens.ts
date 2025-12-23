const ACCESS_KEY = "kc_access";
const REFRESH_KEY = "kc_refresh";

export function getAccess() {
  return localStorage.getItem(ACCESS_KEY) || "";
}
export function getRefresh() {
  return localStorage.getItem(REFRESH_KEY) || "";
}
export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
export function hasTokens() {
  return Boolean(getAccess() && getRefresh());
}
