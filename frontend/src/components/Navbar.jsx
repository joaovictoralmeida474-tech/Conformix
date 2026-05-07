import { getStoredUser } from "../utils/authStorage";

export default function Navbar({ themePreset = "tech-clean", onThemeChange }) {
  const user = getStoredUser();
  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  return (
    <div className="navbar">
      <div>
        <strong>Painel de Fornecedores</strong>
        <div className="navbar-subtitle">
          Visao operacional e auditoravel do programa de homologacao
        </div>
      </div>
      <div className="navbar-meta">
        <label className="theme-preset-control" htmlFor="theme-preset-select">
          <span>Preset visual</span>
          <select
            id="theme-preset-select"
            value={themePreset}
            onChange={(event) => onThemeChange?.(event.target.value)}
          >
            <option value="tech-clean">Tech Clean</option>
            <option value="cyber-neon">Cyber Neon</option>
            <option value="ultra-futuristic">Ultra Futuristic</option>
          </select>
        </label>
        <span>{today}</span>
        <strong>{user?.name || user?.email || "Visitante"}</strong>
      </div>
    </div>
  );
}
