import * as adminService from "./adminService.js";
import { PERMISSION_DEFINITIONS, ROLE_PERMISSION_MAP, ROLES, normalizeRole } from "../../shared/auth/permissions.js";
import { isSupabaseDataConfigured } from "../../shared/config/supabaseEnv.js";
import {
  ensurePlatformBootstrap,
  hasUsablePostgresDatabase,
  testDatabaseConnection
} from "../../shared/database/platformBootstrap.js";

function isDatabaseUnavailableError(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");

  return (
    code.startsWith("P") ||
    /prisma/i.test(error?.name || "") ||
    /supabase/i.test(message) ||
    /can't reach database server/i.test(message) ||
    /authentication failed/i.test(message)
  );
}

function buildOverviewFallback(user) {
  const role = normalizeRole(user?.role);

  if (role === ROLES.SUPER_ADMIN) {
    return {
      mode: "SUPER_ADMIN",
      stats: {
        companies: 0,
        departments: 0,
        users: 0,
        admins: 0
      },
      departments: [],
      recentLogs: []
    };
  }

  return {
    mode: "ADMIN",
    stats: {
      users: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      departmentName: "Sem departamento"
    },
    department: null,
    recentLogs: []
  };
}

function buildSettingsFallback(options = {}) {
  const { localDbUnavailable = true, databaseError = "" } = options;

  return {
    companies: [],
    permissionCatalog: PERMISSION_DEFINITIONS.map((item) => ({
      ...item,
      enabledByDefaultFor: Object.entries(ROLE_PERMISSION_MAP)
        .filter(([, keys]) => keys.includes(item.key))
        .map(([role]) => role)
    })),
    rolePermissionTemplates: {
      admin: ROLE_PERMISSION_MAP[ROLES.ADMIN] || [],
      user: ROLE_PERMISSION_MAP[ROLES.USER] || []
    },
    adminRoutes: [
      "/admin",
      "/admin/usuarios",
      "/admin/admins",
      "/admin/departamentos",
      "/admin/configuracoes"
    ],
    featureFlags: {
      multiCompanyReady: true,
      departmentScoping: true,
      rbacEnabled: true,
      customUserPermissions: true,
      localDbUnavailable,
      databaseError
    }
  };
}

function handleError(res, error) {
  if (isDatabaseUnavailableError(error)) {
    return res.status(503).json({
      error:
        "Banco de dados indisponivel. Na Vercel, configure SUPABASE_URL e SUPABASE_ANON_KEY do projeto Supabase."
    });
  }

  res.status(400).json({ error: error.message });
}

export async function getAdminOverview(req, res) {
  if (!hasUsablePostgresDatabase()) {
    return res.json(buildOverviewFallback(req.user));
  }

  try {
    await ensurePlatformBootstrap(req.user);
    const data = await adminService.getOverview(req.user);
    res.json(data);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.json(buildOverviewFallback(req.user));
    }

    handleError(res, error);
  }
}

export async function listUsers(req, res) {
  if (!hasUsablePostgresDatabase()) {
    return res.json([]);
  }

  try {
    const data = await adminService.listUsers(req.user);
    res.json(data);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.json([]);
    }

    handleError(res, error);
  }
}

export async function createUser(req, res) {
  try {
    const data = await adminService.createUser(req.user, req.body);
    res.status(201).json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateUser(req, res) {
  try {
    const data = await adminService.updateUser(req.user, req.params.id, req.body);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function setUserStatus(req, res) {
  try {
    const data = await adminService.setUserStatus(req.user, req.params.id, req.body.active);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteUser(req, res) {
  try {
    await adminService.deleteUser(req.user, req.params.id);
    res.sendStatus(204);
  } catch (error) {
    handleError(res, error);
  }
}

export async function resetUserPassword(req, res) {
  try {
    await adminService.resetUserPassword(req.user, req.params.id, req.body.password);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
}

export async function listAdmins(req, res) {
  if (!hasUsablePostgresDatabase()) {
    return res.json([]);
  }

  try {
    const data = await adminService.listAdmins(req.user);
    res.json(data);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.json([]);
    }

    handleError(res, error);
  }
}

export async function createAdmin(req, res) {
  try {
    const data = await adminService.createAdmin(req.user, req.body);
    res.status(201).json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateAdmin(req, res) {
  try {
    const data = await adminService.updateAdmin(req.user, req.params.id, req.body);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function setAdminStatus(req, res) {
  try {
    const data = await adminService.setAdminStatus(req.user, req.params.id, req.body.active);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteAdmin(req, res) {
  try {
    await adminService.deleteAdmin(req.user, req.params.id);
    res.sendStatus(204);
  } catch (error) {
    handleError(res, error);
  }
}

export async function resetAdminPassword(req, res) {
  try {
    await adminService.resetAdminPassword(req.user, req.params.id, req.body.password);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
}

export async function listDepartments(req, res) {
  if (!hasUsablePostgresDatabase()) {
    return res.json([]);
  }

  try {
    await ensurePlatformBootstrap(req.user);
    const data = await adminService.listDepartments(req.user);
    res.json(data);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.json([]);
    }

    handleError(res, error);
  }
}

export async function createDepartment(req, res) {
  try {
    const data = await adminService.createDepartment(req.user, req.body);
    res.status(201).json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateDepartment(req, res) {
  try {
    const data = await adminService.updateDepartment(req.user, req.params.id, req.body);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteDepartment(req, res) {
  try {
    await adminService.deleteDepartment(req.user, req.params.id);
    res.sendStatus(204);
  } catch (error) {
    handleError(res, error);
  }
}

export async function createCompany(req, res) {
  try {
    const data = await adminService.createCompany(req.user, req.body);
    res.status(201).json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteCompany(req, res) {
  try {
    await adminService.deleteCompany(req.user, req.params.id);
    res.sendStatus(204);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getSettings(req, res) {
  if (!isSupabaseDataConfigured()) {
    return res.json(
      buildSettingsFallback({
        localDbUnavailable: true,
        databaseError:
          "Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY na Vercel."
      })
    );
  }

  const canConnect = await testDatabaseConnection();

  if (!canConnect) {
    return res.json(
      buildSettingsFallback({
        localDbUnavailable: true,
        databaseError:
          "Nao foi possivel acessar o Supabase. Verifique SUPABASE_URL e SUPABASE_ANON_KEY e faca um novo deploy."
      })
    );
  }

  try {
    await ensurePlatformBootstrap(req.user);
    const data = await adminService.getSettings(req.user);

    res.json({
      ...data,
      featureFlags: {
        ...(data.featureFlags || {}),
        localDbUnavailable: false,
        databaseError: ""
      }
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.json(
        buildSettingsFallback({
          localDbUnavailable: true,
          databaseError: error?.message || "Erro ao acessar o banco de dados."
        })
      );
    }

    handleError(res, error);
  }
}

export async function listSystemLogs(req, res) {
  if (!hasUsablePostgresDatabase()) {
    return res.json([]);
  }

  try {
    const data = await adminService.listSystemLogs(req.user);
    res.json(data);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.json([]);
    }

    handleError(res, error);
  }
}
