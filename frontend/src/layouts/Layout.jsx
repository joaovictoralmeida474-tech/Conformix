import { useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function Layout({ children }) {
  useEffect(() => {
    document.body.setAttribute("data-theme-preset", "tech-clean");
    window.localStorage.setItem("integraxx-theme-preset", "tech-clean");
  }, []);

  return (
    <div className="main-shell">
      <div className="app-tech-orb app-tech-orb-a" />
      <div className="app-tech-orb app-tech-orb-b" />
      <div className="app-tech-grid" />
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
