export const APP_THEME_STORAGE_KEY = "integraxx-app-theme";
export const APP_THEMES = {
  DARK: "dark",
  LIGHT: "light"
};

export function getStoredAppTheme() {
  const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
  return stored === APP_THEMES.LIGHT ? APP_THEMES.LIGHT : APP_THEMES.DARK;
}

export function applyAppTheme(theme) {
  const normalized = theme === APP_THEMES.LIGHT ? APP_THEMES.LIGHT : APP_THEMES.DARK;
  document.body.setAttribute("data-app-theme", normalized);
  window.localStorage.setItem(APP_THEME_STORAGE_KEY, normalized);
  return normalized;
}

export function isLoginRoute(pathname = window.location.pathname) {
  return pathname === "/" || pathname === "";
}
