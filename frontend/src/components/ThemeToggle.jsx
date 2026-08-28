import { APP_THEMES } from "../utils/appTheme";
import { useAppTheme } from "../hooks/useAppTheme";

export default function ThemeToggle() {
  const { theme, setTheme } = useAppTheme();

  return (
    <div className="app-theme-toggle" role="group" aria-label="Tema da interface">
      <button
        type="button"
        className={`app-theme-toggle-button${theme === APP_THEMES.DARK ? " is-active" : ""}`}
        onClick={() => setTheme(APP_THEMES.DARK)}
        aria-pressed={theme === APP_THEMES.DARK}
        title="Modo escuro"
      >
        <i className="ri-moon-line" aria-hidden="true" />
        <span>Escuro</span>
      </button>
      <button
        type="button"
        className={`app-theme-toggle-button${theme === APP_THEMES.LIGHT ? " is-active" : ""}`}
        onClick={() => setTheme(APP_THEMES.LIGHT)}
        aria-pressed={theme === APP_THEMES.LIGHT}
        title="Modo claro"
      >
        <i className="ri-sun-line" aria-hidden="true" />
        <span>Claro</span>
      </button>
    </div>
  );
}
