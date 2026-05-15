import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useStoredUser } from "../hooks/useStoredUser";
import { api } from "../services/api";
import { PERMISSIONS, ROLES, hasPermission, normalizeRole } from "../utils/access";

const emptyUserForm = {
  name: "",
  email: "",
  password: "",
  companyId: "",
  departmentId: "",
  permissionKeys: [],
  active: true
};

const emptyAdminForm = {
  name: "",
  email: "",
  password: "",
  companyId: "",
  departmentId: "",
  permissionKeys: [],
  active: true
};

const emptyDepartmentForm = {
  name: "",
  slug: "",
  description: "",
  companyId: "",
  active: true
};

const emptyCompanyForm = {
  name: "",
  description: ""
};

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString("pt-BR") : "-";
}

function getSectionFromPath(pathname) {
  if (pathname.includes("/admin/admins")) return "admins";
  if (pathname.includes("/admin/departamentos")) return "departments";
  if (pathname.includes("/admin/configuracoes")) return "settings";
  if (pathname.includes("/admin/usuarios")) return "users";
  return "overview";
}

function FieldHint({ children }) {
  return <small className="admin-field-hint">{children}</small>;
}

function getApiErrorMessage(err, fallbackMessage) {
  const status = err?.response?.status;

  if (typeof err?.response?.data?.error === "string" && err.response.data.error.trim()) {
    return err.response.data.error;
  }

  if (status === 404) {
    return "A rota de exclusao nao foi encontrada no backend em execucao. Recarregue a pagina e tente novamente.";
  }

  if (status === 400) {
    return fallbackMessage;
  }

  if (typeof err?.message === "string" && err.message.trim()) {
    return err.message;
  }

  return fallbackMessage;
}

function PermissionSelector({ catalog, selectedKeys, onToggle, title, emptyMessage }) {
  return (
    <div className="admin-permission-selector">
      <div>
        <strong>{title}</strong>
        <FieldHint>Marque exatamente o que este login podera acessar e executar no site.</FieldHint>
      </div>
      {catalog.length ? (
        <div className="admin-permission-checklist">
          {catalog.map((item) => {
            const checked = selectedKeys.includes(item.key);

            return (
              <label key={item.key} className={`admin-permission-chip ${checked ? "is-selected" : ""}`}>
                <input type="checkbox" checked={checked} onChange={() => onToggle(item.key)} />
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.key}</span>
                </div>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="dashboard-empty-copy">{emptyMessage}</p>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="admin-modal-header">
          <div>
            <span className="dashboard-card-eyebrow">Gestao administrativa</span>
            <h3>{title}</h3>
          </div>
          <button type="button" className="supplier-row-button" onClick={onClose}>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AdminEditorPanel({ title, children, onClose }) {
  return (
    <div className="category-shell">
      <section className="category-form-panel">
        <div className="supplier-form-heading">
          <div>
            <span className="dashboard-card-eyebrow supplier-hero-kicker">Gestao administrativa</span>
            <h2>{title}</h2>
          </div>
          <div className="supplier-hero-actions supplier-hero-actions-right">
            <button
              className="supplier-toolbar-button supplier-toolbar-button-muted"
              type="button"
              onClick={onClose}
            >
              Voltar
            </button>
          </div>
        </div>
        {children}
      </section>
    </div>
  );
}

function SectionTabs({ user }) {
  const items = [
    { to: "/admin", label: "Dashboard", visible: hasPermission(user, PERMISSIONS.ADMIN_DASHBOARD_VIEW) },
    { to: "/admin/usuarios", label: "Usuarios", visible: hasPermission(user, PERMISSIONS.USERS_VIEW) },
    { to: "/admin/admins", label: "Admins", visible: hasPermission(user, PERMISSIONS.ADMINS_VIEW) },
    {
      to: "/admin/departamentos",
      label: "Departamentos",
      visible: hasPermission(user, PERMISSIONS.DEPARTMENTS_VIEW)
    },
    {
      to: "/admin/configuracoes",
      label: "Configuracoes",
      visible: hasPermission(user, PERMISSIONS.SETTINGS_VIEW)
    }
  ].filter((item) => item.visible);

  return (
    <div className="admin-tabs">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === "/admin"} className="admin-tab-link">
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

export default function AdminPortal() {
  const location = useLocation();
  const user = useStoredUser();
  const role = normalizeRole(user?.role);
  const section = getSectionFromPath(location.pathname);

  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [userModal, setUserModal] = useState(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [adminModal, setAdminModal] = useState(null);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [departmentModal, setDepartmentModal] = useState(null);
  const [departmentForm, setDepartmentForm] = useState(emptyDepartmentForm);
  const [companyModal, setCompanyModal] = useState(false);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [passwordModal, setPasswordModal] = useState(null);
  const [password, setPassword] = useState("");

  const companies = useMemo(() => settings?.companies || [], [settings]);
  const permissionCatalog = useMemo(() => settings?.permissionCatalog || [], [settings]);
  const localDbUnavailable = Boolean(settings?.featureFlags?.localDbUnavailable);
  const availableUserDepartments = useMemo(() => {
    if (role !== ROLES.SUPER_ADMIN) {
      return departments.filter((item) => Number(item.id) === Number(user?.departmentId));
    }

    const targetCompanyId = Number(userForm.companyId || 0) || null;

    if (!targetCompanyId) return departments;
    return departments.filter((item) => Number(item.companyId) === targetCompanyId);
  }, [departments, role, user?.departmentId, userForm.companyId]);

  const availableAdminDepartments = useMemo(() => {
    if (role !== ROLES.SUPER_ADMIN) {
      return departments.filter((item) => Number(item.id) === Number(user?.departmentId));
    }

    const targetCompanyId = Number(adminForm.companyId || 0) || null;

    if (!targetCompanyId) return departments;
    return departments.filter((item) => Number(item.companyId) === targetCompanyId);
  }, [adminForm.companyId, departments, role, user?.departmentId]);

  async function loadOverview() {
    const { data } = await api.get("/admin/overview");
    setOverview(data);
  }

  async function loadUsers() {
    const { data } = await api.get("/admin/users");
    setUsers(data);
  }

  async function loadAdmins() {
    const { data } = await api.get("/admin/admins");
    setAdmins(data);
  }

  async function loadDepartments() {
    const { data } = await api.get("/admin/departments");
    setDepartments(data);
  }

  async function loadSettings() {
    const { data } = await api.get("/admin/settings");
    setSettings(data);
  }

  async function loadSectionData() {
    try {
      setLoading(true);
      setError("");

      if (section === "overview") {
        await Promise.all([
          loadOverview(),
          hasPermission(user, PERMISSIONS.DEPARTMENTS_VIEW) ? loadDepartments() : Promise.resolve()
        ]);
      }

      if (section === "users") {
        await Promise.all([
          loadUsers(),
          hasPermission(user, PERMISSIONS.DEPARTMENTS_VIEW) ? loadDepartments() : Promise.resolve(),
          hasPermission(user, PERMISSIONS.USERS_MANAGE) ? loadSettings() : Promise.resolve()
        ]);
      }

      if (section === "admins") {
        await Promise.all([loadAdmins(), loadDepartments(), loadSettings()]);
      }

      if (section === "departments") {
        await Promise.all([
          loadDepartments(),
          hasPermission(user, PERMISSIONS.SETTINGS_VIEW) ? loadSettings() : Promise.resolve()
        ]);
      }

      if (section === "settings") {
        await Promise.all([loadSettings(), loadDepartments()]);
      }
    } catch (err) {
      const apiError = err?.response?.data?.error;
      const apiDetails = err?.response?.data?.details;
      setError(
        apiDetails ? `${apiError}: ${apiDetails}` : apiError || "Nao foi possivel carregar o painel administrativo."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSectionData();
  }, [section]);

  function requireLocalDatabase(actionLabel = "executar esta acao") {
    if (!localDbUnavailable) {
      return true;
    }

    setError("");
    setMessage(
      `Banco PostgreSQL indisponivel. Configure DATABASE_URL na Vercel (connection string do Supabase) para ${actionLabel}.`
    );
    return false;
  }

  function openUserModal(record = null) {
    setUserModal(record ? { mode: "edit", id: record.id } : { mode: "create", id: null });
    setUserForm(
      record
        ? {
            name: record.name || "",
            email: record.email || "",
            password: "",
            active: record.active !== false,
            companyId: record.companyId || "",
            departmentId: record.departmentId || user?.departmentId || "",
            permissionKeys: record.permissions || []
          }
        : {
            ...emptyUserForm,
            companyId: role === ROLES.SUPER_ADMIN ? user?.companyId || "" : user?.companyId || "",
            departmentId: user?.departmentId || "",
            permissionKeys: settings?.rolePermissionTemplates?.user || []
          }
    );
    setPassword("");
  }

  function openAdminModal(record = null) {
    setAdminModal(record ? { mode: "edit", id: record.id } : { mode: "create", id: null });
    setAdminForm(
      record
        ? {
            name: record.name || "",
            email: record.email || "",
            password: "",
            companyId: record.companyId || "",
            departmentId: record.departmentId || "",
            permissionKeys: record.permissions || [],
            active: record.active !== false
          }
        : {
            ...emptyAdminForm,
            permissionKeys: settings?.rolePermissionTemplates?.admin || []
          }
    );
  }

  function openDepartmentModal(record = null) {
    setDepartmentModal(record ? { mode: "edit", id: record.id } : { mode: "create", id: null });
    setDepartmentForm(
      record
        ? {
            name: record.name || "",
            slug: record.slug || "",
            description: record.description || "",
            companyId: record.companyId || "",
            active: record.active !== false
          }
        : {
            ...emptyDepartmentForm,
            companyId: companies[0]?.id || ""
          }
    );
  }

  function togglePermission(formKey, permissionKey) {
    const setter = formKey === "admin" ? setAdminForm : setUserForm;

    setter((current) => {
      const alreadySelected = current.permissionKeys.includes(permissionKey);

      return {
        ...current,
        permissionKeys: alreadySelected
          ? current.permissionKeys.filter((item) => item !== permissionKey)
          : [...current.permissionKeys, permissionKey]
      };
    });
  }

  async function submitUser(recordId = null) {
    if (!requireLocalDatabase(recordId ? "atualizar o usuario" : "criar o usuario")) return;

    try {
      const payload = {
        name: userForm.name,
        email: userForm.email,
        active: userForm.active,
        permissionKeys: userForm.permissionKeys
      };

      if (!recordId) {
        payload.password = userForm.password;
      }

      if (role === ROLES.SUPER_ADMIN && userForm.departmentId) {
        payload.departmentId = Number(userForm.departmentId);
        if (userForm.companyId) {
          payload.companyId = Number(userForm.companyId);
        }
      }

      if (recordId) {
        await api.put(`/admin/users/${recordId}`, payload);
        setMessage("Usuario atualizado com sucesso.");
      } else {
        await api.post("/admin/users", payload);
        setMessage("Usuario criado com sucesso.");
      }

      setUserModal(null);
      setUserForm(emptyUserForm);
      await loadUsers();
      await loadOverview().catch(() => null);
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel salvar o usuario.");
    }
  }

  async function toggleUserStatus(record) {
    if (!requireLocalDatabase("alterar o status do usuario")) return;

    try {
      await api.patch(`/admin/users/${record.id}/status`, {
        active: !record.active
      });
      setMessage(record.active ? "Usuario desativado com sucesso." : "Usuario ativado com sucesso.");
      await Promise.all([loadUsers(), loadOverview().catch(() => null)]);
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel alterar o status do usuario.");
    }
  }

  async function removeUser(recordId) {
    if (!requireLocalDatabase("excluir o usuario")) return;

    if (!window.confirm("Deseja excluir este usuario?")) return;

    try {
      await api.delete(`/admin/users/${recordId}`);
      setMessage("Usuario excluido com sucesso.");
      await loadUsers();
      await loadOverview().catch(() => null);
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel excluir o usuario.");
    }
  }

  async function submitAdmin(recordId = null) {
    if (!requireLocalDatabase(recordId ? "atualizar o admin" : "criar o admin")) return;

    try {
      const payload = {
        name: adminForm.name,
        email: adminForm.email,
        active: adminForm.active,
        companyId: Number(adminForm.companyId),
        departmentId: Number(adminForm.departmentId),
        permissionKeys: adminForm.permissionKeys
      };

      if (!recordId) {
        payload.password = adminForm.password;
      }

      if (recordId) {
        await api.put(`/admin/admins/${recordId}`, payload);
        setMessage("Admin atualizado com sucesso.");
      } else {
        await api.post("/admin/admins", payload);
        setMessage("Admin criado com sucesso.");
      }

      setAdminModal(null);
      setAdminForm(emptyAdminForm);
      await Promise.all([loadAdmins(), loadOverview()]);
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel salvar o admin.");
    }
  }

  async function submitCompany() {
    if (!requireLocalDatabase("criar a empresa")) return;

    try {
      await api.post("/admin/companies", companyForm);
      setMessage("Empresa criada com sucesso.");
      setCompanyModal(false);
      setCompanyForm(emptyCompanyForm);
      await Promise.all([loadSettings(), loadDepartments().catch(() => null), loadOverview().catch(() => null)]);
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel criar a empresa.");
    }
  }

  async function removeDepartment(recordId) {
    if (!requireLocalDatabase("excluir o departamento")) return;

    if (!window.confirm("Deseja excluir este departamento?")) return;

    try {
      await api.delete(`/admin/departments/${recordId}`);
      setMessage("Departamento excluido com sucesso.");
      await Promise.all([
        loadDepartments(),
        loadSettings().catch(() => null),
        loadOverview().catch(() => null)
      ]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Nao foi possivel excluir o departamento."));
    }
  }

  async function removeCompany(recordId) {
    if (!requireLocalDatabase("excluir a empresa")) return;

    if (!window.confirm("Deseja excluir esta empresa?")) return;

    try {
      await api.delete(`/admin/companies/${recordId}`);
      setMessage("Empresa excluida com sucesso.");
      await Promise.all([
        loadSettings(),
        loadDepartments().catch(() => null),
        loadOverview().catch(() => null)
      ]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Nao foi possivel excluir a empresa."));
    }
  }

  async function toggleAdminStatus(record) {
    if (!requireLocalDatabase("alterar o status do admin")) return;

    try {
      await api.patch(`/admin/admins/${record.id}/status`, {
        active: !record.active
      });
      setMessage(record.active ? "Admin desativado com sucesso." : "Admin ativado com sucesso.");
      await Promise.all([loadAdmins(), loadOverview()]);
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel alterar o status do admin.");
    }
  }

  async function removeAdmin(recordId) {
    if (!requireLocalDatabase("excluir o admin")) return;

    if (!window.confirm("Deseja excluir este admin?")) return;

    try {
      await api.delete(`/admin/admins/${recordId}`);
      setMessage("Admin excluido com sucesso.");
      await Promise.all([loadAdmins(), loadOverview()]);
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel excluir o admin.");
    }
  }

  async function submitDepartment(recordId = null) {
    if (!requireLocalDatabase(recordId ? "atualizar o departamento" : "criar o departamento")) return;

    try {
      const payload = {
        name: departmentForm.name,
        slug: departmentForm.slug,
        description: departmentForm.description,
        active: departmentForm.active,
        companyId: Number(departmentForm.companyId)
      };

      if (recordId) {
        await api.put(`/admin/departments/${recordId}`, payload);
        setMessage("Departamento atualizado com sucesso.");
      } else {
        await api.post("/admin/departments", payload);
        setMessage("Departamento criado com sucesso.");
      }

      setDepartmentModal(null);
      setDepartmentForm(emptyDepartmentForm);
      await Promise.all([loadDepartments(), loadOverview().catch(() => null)]);
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel salvar o departamento.");
    }
  }

  async function submitPasswordReset() {
    if (!requireLocalDatabase("redefinir a senha")) return;
    if (!passwordModal?.id || !password) return;

    try {
      const endpoint =
        passwordModal.type === "admin"
          ? `/admin/admins/${passwordModal.id}/reset-password`
          : `/admin/users/${passwordModal.id}/reset-password`;

      await api.post(endpoint, { password });
      setMessage("Senha redefinida com sucesso.");
      setPasswordModal(null);
      setPassword("");
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel redefinir a senha.");
    }
  }

  const statsCards =
    role === ROLES.SUPER_ADMIN
      ? [
          { label: "Empresas", value: overview?.stats?.companies ?? 0 },
          { label: "Departamentos", value: overview?.stats?.departments ?? 0 },
          { label: "Usuarios", value: overview?.stats?.users ?? 0 },
          { label: "Admins", value: overview?.stats?.admins ?? 0 }
        ]
      : [
          { label: "Usuarios no departamento", value: overview?.stats?.users ?? 0 },
          { label: "Usuarios ativos", value: overview?.stats?.activeUsers ?? 0 },
          { label: "Usuarios inativos", value: overview?.stats?.inactiveUsers ?? 0 },
          { label: "Departamento", value: overview?.stats?.departmentName ?? "-" }
        ];

  const hasActiveEditor = Boolean(
    userModal || adminModal || departmentModal || companyModal || passwordModal
  );

  return (
    <div className="admin-shell">
      <header className="admin-hero">
        <div>
          <span className="dashboard-card-eyebrow supplier-hero-kicker">Governanca e acessos</span>
          <h1>{role === ROLES.SUPER_ADMIN ? "Painel SUPER_ADMIN" : "Painel administrativo"}</h1>
          <p>
            {role === ROLES.SUPER_ADMIN
              ? "Visao global da plataforma, departamentos, admins e trilhas administrativas."
              : "Visao isolada do seu departamento com foco em usuarios, seguranca e operacao local."}
          </p>
        </div>
      </header>

      <SectionTabs user={user} />

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="success-text">{message}</p> : null}
      {localDbUnavailable ? (
        <p className="dashboard-empty-copy">
          {settings?.featureFlags?.databaseError ||
            "O painel administrativo esta em modo reduzido porque o banco PostgreSQL nao esta conectado. Na Vercel, confira `DATABASE_URL` (copie a URI do Supabase em Database → Connection string) e faca um novo deploy."}
        </p>
      ) : null}
      {loading ? <p className="dashboard-empty-copy">Carregando painel administrativo...</p> : null}

      {!hasActiveEditor && section === "overview" ? (
        <>
          <section className="admin-stat-grid">
            {statsCards.map((card) => (
              <article key={card.label} className="dashboard-stat-card admin-stat-card">
                <span className="dashboard-card-eyebrow">{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </section>

          <section className="admin-overview-grid">
            <article className="table-card admin-table-card">
              <div className="admin-panel-header">
                <div>
                  <span className="dashboard-card-eyebrow">Estrutura</span>
                  <h3>{role === ROLES.SUPER_ADMIN ? "Departamentos por empresa" : "Seu departamento"}</h3>
                </div>
              </div>
              <div className="supplier-table-wrap">
                <table className="supplier-table">
                  <thead>
                    <tr>
                      <th>Departamento</th>
                      <th>Empresa</th>
                      <th>Usuarios</th>
                      <th>Admins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(role === ROLES.SUPER_ADMIN ? overview?.departments : [overview?.department])
                      ?.filter(Boolean)
                      ?.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.company?.name || "-"}</td>
                          <td>{item.userCount || 0}</td>
                          <td>{item.adminCount || 0}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </article>

          </section>
        </>
      ) : null}

      {!hasActiveEditor && section === "users" ? (
        <section className="table-card admin-table-card">
          <div className="admin-panel-header">
            <div>
              <span className="dashboard-card-eyebrow">Usuarios comuns</span>
              <h3>{role === ROLES.SUPER_ADMIN ? "Base global de usuarios" : "Usuarios do seu departamento"}</h3>
            </div>
            {hasPermission(user, PERMISSIONS.USERS_MANAGE) ? (
              <button className="supplier-toolbar-button supplier-toolbar-button-primary" type="button" onClick={() => openUserModal()}>
                Novo usuario
              </button>
            ) : null}
          </div>

          <div className="supplier-table-wrap">
            <table className="supplier-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Departamento</th>
                  <th>Status</th>
                  <th>Ultimo login</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {users.length ? (
                  users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.email}</td>
                      <td>{item.department?.name || "-"}</td>
                      <td>{item.active ? "Ativo" : "Inativo"}</td>
                      <td>{formatDateTime(item.lastLoginAt)}</td>
                      <td>
                        <div className="supplier-action-row">
                          <button className="supplier-row-button" type="button" onClick={() => openUserModal(item)}>
                            Editar
                          </button>
                          <button className="supplier-row-button" type="button" onClick={() => toggleUserStatus(item)}>
                            {item.active ? "Desativar" : "Ativar"}
                          </button>
                          <button
                            className="supplier-row-button"
                            type="button"
                            onClick={() => setPasswordModal({ id: item.id, type: "user", label: item.name })}
                          >
                            Resetar senha
                          </button>
                          <button
                            className="supplier-row-button supplier-row-button-danger"
                            type="button"
                            onClick={() => removeUser(item.id)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="dashboard-empty-copy">
                      Nenhum usuario encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!hasActiveEditor && section === "admins" ? (
        <section className="table-card admin-table-card">
          <div className="admin-panel-header">
            <div>
              <span className="dashboard-card-eyebrow">Administradores</span>
              <h3>Gestao global de admins</h3>
            </div>
            <button className="supplier-toolbar-button supplier-toolbar-button-primary" type="button" onClick={() => openAdminModal()}>
              Novo admin
            </button>
          </div>

          <div className="supplier-table-wrap">
            <table className="supplier-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Empresa</th>
                  <th>Departamento</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {admins.length ? (
                  admins.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.email}</td>
                      <td>{item.company?.name || "-"}</td>
                      <td>{item.department?.name || "-"}</td>
                      <td>{item.active ? "Ativo" : "Inativo"}</td>
                      <td>
                        <div className="supplier-action-row">
                          <button className="supplier-row-button" type="button" onClick={() => openAdminModal(item)}>
                            Editar
                          </button>
                          <button className="supplier-row-button" type="button" onClick={() => toggleAdminStatus(item)}>
                            {item.active ? "Desativar" : "Ativar"}
                          </button>
                          <button
                            className="supplier-row-button"
                            type="button"
                            onClick={() => setPasswordModal({ id: item.id, type: "admin", label: item.name })}
                          >
                            Resetar senha
                          </button>
                          <button
                            className="supplier-row-button supplier-row-button-danger"
                            type="button"
                            onClick={() => removeAdmin(item.id)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="dashboard-empty-copy">
                      Nenhum admin encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!hasActiveEditor && section === "departments" ? (
        <section className="table-card admin-table-card">
          <div className="admin-panel-header">
            <div>
              <span className="dashboard-card-eyebrow">Departamentos</span>
              <h3>Estrutura organizacional</h3>
            </div>
            {role === ROLES.SUPER_ADMIN && hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE) ? (
              <button className="supplier-toolbar-button supplier-toolbar-button-primary" type="button" onClick={() => openDepartmentModal()}>
                Novo departamento
              </button>
            ) : null}
          </div>

          <div className="supplier-table-wrap">
            <table className="supplier-table">
              <thead>
                <tr>
                  <th>Departamento</th>
                  <th>Empresa</th>
                  <th>Usuarios</th>
                  <th>Admins</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {departments.length ? (
                  departments.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.company?.name || "-"}</td>
                      <td>{item.userCount || 0}</td>
                      <td>{item.adminCount || 0}</td>
                      <td>{item.active ? "Ativo" : "Inativo"}</td>
                      <td>
                        {role === ROLES.SUPER_ADMIN && hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE) ? (
                          <div className="supplier-action-row">
                            <button className="supplier-row-button" type="button" onClick={() => openDepartmentModal(item)}>
                              Editar
                            </button>
                            <button
                              className="supplier-row-button supplier-row-button-danger"
                              type="button"
                              onClick={() => removeDepartment(item.id)}
                            >
                              Excluir
                            </button>
                          </div>
                        ) : (
                          <span className="dashboard-empty-copy">Somente leitura</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="dashboard-empty-copy">
                      Nenhum departamento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!hasActiveEditor && section === "settings" ? (
        <div className="admin-overview-grid">
          <section className="table-card admin-table-card">
            <div className="admin-panel-header">
              <div>
                <span className="dashboard-card-eyebrow">Configuracoes globais</span>
                <h3>Empresas e flags</h3>
              </div>
              {role === ROLES.SUPER_ADMIN ? (
                <button
                  className="supplier-toolbar-button supplier-toolbar-button-primary"
                  type="button"
                  onClick={() => setCompanyModal(true)}
                >
                  Nova empresa
                </button>
              ) : null}
            </div>
            <div className="admin-settings-stack">
              {(settings?.companies || []).map((item) => (
                <div key={item.id} className="admin-setting-card">
                  <strong>{item.name}</strong>
                  <p>{item._count?.users || 0} usuarios</p>
                  <span>{item._count?.departments || 0} departamentos</span>
                  <span>{item._count?.suppliers || 0} fornecedores</span>
                  <span>{item._count?.categories || 0} categorias</span>
                  {role === ROLES.SUPER_ADMIN ? (
                    <div className="supplier-form-actions">
                      <button
                        className="supplier-row-button supplier-row-button-danger"
                        type="button"
                        onClick={() => removeCompany(item.id)}
                      >
                        Excluir empresa
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="table-card admin-table-card">
            <div className="admin-panel-header">
              <div>
                <span className="dashboard-card-eyebrow">Catalogo de permissoes</span>
                <h3>RBAC pronto para evolucao</h3>
              </div>
            </div>
            <div className="admin-permission-list">
              {(settings?.permissionCatalog || []).map((item) => (
                <div key={item.key} className="admin-permission-item">
                  <strong>{item.key}</strong>
                  <p>{item.name}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {userModal ? (
        <AdminEditorPanel
          title={userModal.mode === "create" ? "Novo usuario" : "Editar usuario"}
          onClose={() => setUserModal(null)}
        >
          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label className="admin-form-label">Nome</label>
              <input className="supplier-form-input" placeholder="Nome completo do usuario" value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">E-mail</label>
              <input className="supplier-form-input" placeholder="login@empresa.com" value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            {userModal.mode === "create" ? (
              <div className="admin-form-field">
                <label className="admin-form-label">Senha inicial</label>
                <input className="supplier-form-input" placeholder="Defina a senha inicial" type="password" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} />
              </div>
            ) : null}
            {role === ROLES.SUPER_ADMIN ? (
              <div className="admin-form-field">
                <label className="admin-form-label">Empresa</label>
                <select
                  className="supplier-form-input"
                  value={userForm.companyId}
                  onChange={(event) =>
                    setUserForm((current) => ({ ...current, companyId: event.target.value, departmentId: "" }))
                  }
                >
                  <option value="">Selecione a empresa</option>
                  {companies.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {role === ROLES.SUPER_ADMIN ? (
              <div className="admin-form-field">
                <label className="admin-form-label">Departamento</label>
                <select className="supplier-form-input" value={userForm.departmentId} onChange={(event) => setUserForm((current) => ({ ...current, departmentId: event.target.value }))}>
                  <option value="">Selecione o departamento</option>
                  {availableUserDepartments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.company?.name ? `${item.company.name} - ${item.name}` : item.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="admin-form-field admin-form-field-full">
              <PermissionSelector
                catalog={permissionCatalog}
                selectedKeys={userForm.permissionKeys}
                onToggle={(permissionKey) => togglePermission("user", permissionKey)}
                title="Permissoes do usuario"
                emptyMessage="Nenhuma permissao disponivel para atribuicao."
              />
            </div>
            <label className="category-active-toggle">
              <input type="checkbox" checked={userForm.active} onChange={(event) => setUserForm((current) => ({ ...current, active: event.target.checked }))} />
              <span>Usuario ativo</span>
            </label>
            <div className="supplier-form-actions">
              <button className="supplier-save-button" type="button" onClick={() => submitUser(userModal.id)}>
                Salvar usuario
              </button>
            </div>
          </div>
        </AdminEditorPanel>
      ) : null}

      {adminModal ? (
        <AdminEditorPanel
          title={adminModal.mode === "create" ? "Novo admin" : "Editar admin"}
          onClose={() => setAdminModal(null)}
        >
          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label className="admin-form-label">Nome</label>
              <input className="supplier-form-input" placeholder="Nome do administrador" value={adminForm.name} onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">E-mail</label>
              <input className="supplier-form-input" placeholder="admin@empresa.com" value={adminForm.email} onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            {adminModal.mode === "create" ? (
              <div className="admin-form-field">
                <label className="admin-form-label">Senha inicial</label>
                <input className="supplier-form-input" placeholder="Defina a senha inicial do admin" type="password" value={adminForm.password} onChange={(event) => setAdminForm((current) => ({ ...current, password: event.target.value }))} />
              </div>
            ) : null}
            <div className="admin-form-field">
              <label className="admin-form-label">Empresa</label>
              <select className="supplier-form-input" value={adminForm.companyId} onChange={(event) => setAdminForm((current) => ({ ...current, companyId: event.target.value, departmentId: "" }))}>
                <option value="">Selecione a empresa</option>
                {companies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-form-field">
                <label className="admin-form-label">Departamento</label>
                <select className="supplier-form-input" value={adminForm.departmentId} onChange={(event) => setAdminForm((current) => ({ ...current, departmentId: event.target.value }))}>
                  <option value="">Selecione o departamento</option>
                  {availableAdminDepartments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                ))}
              </select>
            </div>
            <div className="admin-form-field admin-form-field-full">
              <PermissionSelector
                catalog={permissionCatalog}
                selectedKeys={adminForm.permissionKeys}
                onToggle={(permissionKey) => togglePermission("admin", permissionKey)}
                title="Permissoes do admin"
                emptyMessage="Nenhuma permissao disponivel para atribuicao."
              />
            </div>
            <label className="category-active-toggle">
              <input type="checkbox" checked={adminForm.active} onChange={(event) => setAdminForm((current) => ({ ...current, active: event.target.checked }))} />
              <span>Admin ativo</span>
            </label>
            <div className="supplier-form-actions">
              <button className="supplier-save-button" type="button" onClick={() => submitAdmin(adminModal.id)}>
                Salvar admin
              </button>
            </div>
          </div>
        </AdminEditorPanel>
      ) : null}

      {departmentModal ? (
        <AdminEditorPanel
          title={departmentModal.mode === "create" ? "Novo departamento" : "Editar departamento"}
          onClose={() => setDepartmentModal(null)}
        >
          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label className="admin-form-label">Nome do departamento</label>
              <input className="supplier-form-input" placeholder="Ex.: Qualidade, Compras, Operacoes" value={departmentForm.name} onChange={(event) => setDepartmentForm((current) => ({ ...current, name: event.target.value }))} />
              <FieldHint>Este nome sera exibido para os usuarios ao vincular logins e organizar a empresa.</FieldHint>
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">Slug interno</label>
              <input className="supplier-form-input" placeholder="Ex.: qualidade, compras, operacoes" value={departmentForm.slug} onChange={(event) => setDepartmentForm((current) => ({ ...current, slug: event.target.value }))} />
              <FieldHint>Identificador interno usado pelo sistema. Prefira texto curto, sem espacos e em minusculo.</FieldHint>
            </div>
            <div className="admin-form-field admin-form-field-full">
              <label className="admin-form-label">Descricao</label>
              <textarea className="supplier-form-textarea" placeholder="Explique qual e a funcao deste departamento dentro da empresa" value={departmentForm.description} onChange={(event) => setDepartmentForm((current) => ({ ...current, description: event.target.value }))} />
              <FieldHint>Use este campo para explicar a responsabilidade do departamento e facilitar futuras manutencoes.</FieldHint>
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">Empresa</label>
              <select className="supplier-form-input" value={departmentForm.companyId} onChange={(event) => setDepartmentForm((current) => ({ ...current, companyId: event.target.value }))}>
                <option value="">Selecione a empresa</option>
                {companies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <FieldHint>Escolha a empresa dona deste departamento. Se a empresa ainda nao existir, crie-a primeiro em Configuracoes.</FieldHint>
              {role === ROLES.SUPER_ADMIN ? (
                <div className="supplier-form-actions">
                  <button className="supplier-row-button" type="button" onClick={() => setCompanyModal(true)}>
                    Criar empresa agora
                  </button>
                </div>
              ) : null}
            </div>
            <label className="category-active-toggle">
              <input type="checkbox" checked={departmentForm.active} onChange={(event) => setDepartmentForm((current) => ({ ...current, active: event.target.checked }))} />
              <span>Departamento ativo</span>
            </label>
            <div className="supplier-form-actions">
              <button className="supplier-save-button" type="button" onClick={() => submitDepartment(departmentModal.id)}>
                Salvar departamento
              </button>
            </div>
          </div>
        </AdminEditorPanel>
      ) : null}

      {companyModal ? (
        <AdminEditorPanel title="Nova empresa" onClose={() => setCompanyModal(false)}>
          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label className="admin-form-label">Nome da empresa</label>
              <input
                className="supplier-form-input"
                placeholder="Ex.: Fornecedores Brasil Ltda"
                value={companyForm.name}
                onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))}
              />
              <FieldHint>Cadastre aqui uma nova empresa para depois vincular departamentos, admins e usuarios.</FieldHint>
            </div>
            <div className="admin-form-field admin-form-field-full">
              <label className="admin-form-label">Observacao</label>
              <textarea
                className="supplier-form-textarea"
                placeholder="Informacao complementar para lembrar o contexto desta empresa"
                value={companyForm.description}
                onChange={(event) => setCompanyForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
            <div className="supplier-form-actions">
              <button className="supplier-save-button" type="button" onClick={submitCompany}>
                Salvar empresa
              </button>
            </div>
          </div>
        </AdminEditorPanel>
      ) : null}

      {passwordModal ? (
        <AdminEditorPanel
          title={`Resetar senha de ${passwordModal.label}`}
          onClose={() => setPasswordModal(null)}
        >
          <div className="admin-form-grid">
            <input className="supplier-form-input" type="password" placeholder="Nova senha" value={password} onChange={(event) => setPassword(event.target.value)} />
            <div className="supplier-form-actions">
              <button className="supplier-save-button" type="button" onClick={submitPasswordReset}>
                Atualizar senha
              </button>
            </div>
          </div>
        </AdminEditorPanel>
      ) : null}
    </div>
  );
}
