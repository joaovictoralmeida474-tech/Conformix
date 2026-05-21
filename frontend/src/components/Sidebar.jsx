import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useStoredUser } from "../hooks/useStoredUser";
import { clearSession } from "../utils/authStorage";
import integraxxSidebarLogo from "../assets/integraxx-sidebar-logo-transparent.png";
import integraxxXMark from "../assets/integraxx-x-mark.png";
import { PERMISSIONS, canAccessAdmin, hasPermission } from "../utils/access";

function getInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "IXX";
}

function getRoleLabel(role) {
  const normalized = String(role || "").trim().toUpperCase();
  const labels = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Administrador",
    MANAGER: "Gestor",
    GESTOR: "Gestor",
    QUALITY: "Qualidade",
    USER: "Usuario"
  };

  return labels[normalized] || role || "Administrador";
}

export default function Sidebar() {
  const navigate = useNavigate();
  const user = useStoredUser();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const links = [
    hasPermission(user, PERMISSIONS.DASHBOARD_VIEW)
      ? { to: "/dashboard", label: "Dashboard", icon: "ri-dashboard-line" }
      : null,
    hasPermission(user, PERMISSIONS.SUPPLIERS_VIEW)
      ? { to: "/suppliers", label: "Fornecedores", icon: "ri-building-2-line" }
      : null,
    hasPermission(user, PERMISSIONS.CATEGORIES_VIEW)
      ? { to: "/categories", label: "Categorias", icon: "ri-price-tag-3-line" }
      : null,
    hasPermission(user, PERMISSIONS.RNC_VIEW)
      ? { to: "/rnc", label: "RNC", icon: "ri-alert-line" }
      : null,
    hasPermission(user, PERMISSIONS.AUDIT_VIEW)
      ? { to: "/audit", label: "Auditoria", icon: "ri-file-list-3-line" }
      : null,
    canAccessAdmin(user)
      ? { to: "/admin", label: "Admin", icon: "ri-shield-user-line" }
      : null
  ].filter(Boolean);

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // Limpa a sessao local mesmo se a API estiver indisponivel.
    }

    clearSession();
    navigate("/");
  }

  useEffect(() => {
    const storedState =
      window.localStorage.getItem("integraxx-sidebar-collapsed") ||
      window.localStorage.getItem("integrax-sidebar-collapsed") ||
      window.localStorage.getItem("conformix-sidebar-collapsed");
    if (storedState === "1") {
      setIsCollapsed(true);
    }
  }, []);

  function toggleCollapse() {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    window.localStorage.setItem("integraxx-sidebar-collapsed", nextState ? "1" : "0");
  }

  return (
    <aside className={`sidebar sidebar--integraxx${isCollapsed ? " is-collapsed" : ""}`}>
      <button
        type="button"
        className="sidebar-collapse-toggle"
        onClick={toggleCollapse}
        aria-label={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        aria-expanded={!isCollapsed}
      >
        <i className={isCollapsed ? "ri-arrow-right-s-line" : "ri-arrow-left-s-line"} aria-hidden="true" />
      </button>

      {!isCollapsed ? (
        <div className="sidebar-brand-panel">
          <img
            src={integraxxSidebarLogo}
            alt="Integraxx"
            className="sidebar-brand-logo"
            width={512}
            height={171}
            decoding="async"
          />
        </div>
      ) : null}

      <nav className="sidebar-nav" aria-label="Menu principal">
        {isCollapsed ? (
          <NavLink
            to={links[0]?.to || "/dashboard"}
            className="sidebar-collapsed-logo-link"
            title="Integraxx"
            aria-label="Integraxx - inicio"
          >
            <img
              src={integraxxXMark}
              alt=""
              className="sidebar-collapsed-logo-img"
              width={95}
              height={109}
              decoding="async"
            />
          </NavLink>
        ) : null}
        <ul className="nav-list">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) =>
                  `nav-link sidebar-menu-link${isActive ? " active" : ""}`
                }
                title={link.label}
              >
                <i className={link.icon} aria-hidden="true" />
                <span>{link.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-profile-card">
        <div className="sidebar-profile-main">
          <div className="sidebar-profile-avatar" aria-hidden="true">
            {getInitials(user?.name || user?.email || "Integraxx")}
          </div>
          {!isCollapsed ? (
            <div className="sidebar-profile-copy">
              <strong>{user?.name || user?.email || "Administrador"}</strong>
              <small>{getRoleLabel(user?.role)}</small>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="sidebar-logout-button"
          onClick={logout}
          aria-label="Sair"
          title="Sair"
        >
          <i className="ri-logout-box-r-line" aria-hidden="true" />
          {!isCollapsed ? <span>Sair</span> : null}
        </button>
      </div>
    </aside>
  );
}
