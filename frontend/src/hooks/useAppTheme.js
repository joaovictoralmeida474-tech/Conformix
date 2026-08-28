import { useCallback, useEffect, useState } from "react";
import { APP_THEMES, applyAppTheme, getStoredAppTheme } from "../utils/appTheme";

export function useAppTheme() {
  const [theme, setThemeState] = useState(() => getStoredAppTheme());

  useEffect(() => {
    setThemeState(applyAppTheme(getStoredAppTheme()));
  }, []);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(applyAppTheme(nextTheme));
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === APP_THEMES.LIGHT ? APP_THEMES.DARK : APP_THEMES.LIGHT;
    setTheme(next);
  }, [setTheme, theme]);

  return {
    theme,
    isLight: theme === APP_THEMES.LIGHT,
    isDark: theme === APP_THEMES.DARK,
    setTheme,
    toggleTheme
  };
}
