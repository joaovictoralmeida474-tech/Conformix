import { useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { applyAppTheme, getStoredAppTheme } from "../utils/appTheme";

export default function Layout({ children }) {
  useEffect(() => {
    document.body.classList.remove("login-theme");
    document.body.setAttribute("data-theme-preset", "login-palette");
    window.localStorage.setItem("integraxx-theme-preset", "login-palette");
    applyAppTheme(getStoredAppTheme());
  }, []);

  return (
    <div className="main-shell main-shell--carbon">
      <Sidebar />
      <div className="main-area">
        <div className="app-content-shell">
          <Navbar />
          <main className="app-page-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
