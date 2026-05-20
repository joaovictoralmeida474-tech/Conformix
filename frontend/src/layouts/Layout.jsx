import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function Layout({ children }) {
  const [themePreset, setThemePreset] = useState("tech-clean");

  useEffect(() => {
    const storedPreset =
      window.localStorage.getItem("integrax-theme-preset") ||
      window.localStorage.getItem("conformix-theme-preset");
    if (storedPreset) {
      setThemePreset(storedPreset);
      document.body.setAttribute("data-theme-preset", storedPreset);
      return;
    }

    document.body.setAttribute("data-theme-preset", "tech-clean");
  }, []);

  useEffect(() => {
    document.body.setAttribute("data-theme-preset", themePreset);
    window.localStorage.setItem("integrax-theme-preset", themePreset);
  }, [themePreset]);

  return (
    <div className="main-shell">
      <div className="app-tech-orb app-tech-orb-a" />
      <div className="app-tech-orb app-tech-orb-b" />
      <div className="app-tech-grid" />
      <Sidebar />
      <div className="main-area">
        <div className="app-content-shell">
          <Navbar themePreset={themePreset} onThemeChange={setThemePreset} />
          <main className="app-page-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
