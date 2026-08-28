import { useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { getPageHeading } from "../utils/pageHeadings";

export default function Navbar() {
  const { pathname } = useLocation();
  const { title, description } = getPageHeading(pathname);

  return (
    <header className="navbar app-page-navbar" aria-label="Contexto da página">
      <div className="app-page-navbar-copy">
        <h1 className="app-page-navbar-title">{title}</h1>
        <p className="app-page-navbar-description">{description}</p>
      </div>
      <ThemeToggle />
    </header>
  );
}
