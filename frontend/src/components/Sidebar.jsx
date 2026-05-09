import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearSession, getStoredUser } from "../utils/authStorage";
import conformixLogo from "../assets/conformix-logo-v2-transparent.png";
import { PERMISSIONS, canAccessAdmin, hasPermission } from "../utils/access";

function getInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "CF";
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
  const user = getStoredUser();
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
    clearSession();
    navigate("/");
  }

  useEffect(() => {
    const storedState = window.localStorage.getItem("conformix-sidebar-collapsed");
    if (storedState === "1") {
      setIsCollapsed(true);
    }
  }, []);

  function toggleCollapse() {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    window.localStorage.setItem("conformix-sidebar-collapsed", nextState ? "1" : "0");
  }

  return (
    <aside className={`sidebar sidebar--conformix${isCollapsed ? " is-collapsed" : ""}`}>
      <button
        type="button"
        className="sidebar-collapse-toggle"
        onClick={toggleCollapse}
        aria-label={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
      >
        <i className={isCollapsed ? "ri-arrow-right-s-line" : "ri-arrow-left-s-line"} />
      </button>

      <div className="sidebar-brand-panel">
        <img
          src={conformixLogo}
          alt="Conformix"
          className="sidebar-brand-logo"
        />
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-list">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} className="nav-link sidebar-menu-link" title={link.label}>
                <i className={link.icon} />
                <span>{link.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-profile-card">
        <div className="sidebar-profile-avatar">{getInitials(user?.name || user?.email || "Conformix")}</div>
        <div className="sidebar-profile-copy">
          <strong>{user?.name || user?.email || "Administrador"}</strong>
          <small>{getRoleLabel(user?.role)}</small>
        </div>
        <button
          type="button"
          className="nav-button sidebar-logout-inline"
          onClick={logout}
          aria-label="Sair"
          title="Sair"
        >
          <i className="ri-logout-box-r-line" />
        </button>
      </div>
    </aside>
  );
}
