export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  USER: "USER"
};

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  SUPPLIERS_VIEW: "suppliers:view",
  SUPPLIERS_MANAGE: "suppliers:manage",
  SUPPLIERS_EVALUATE: "suppliers:evaluate",
  SUPPLIERS_EXPORT: "suppliers:export",
  CATEGORIES_VIEW: "categories:view",
  CATEGORIES_MANAGE: "categories:manage",
  RNC_VIEW: "rnc:view",
  RNC_MANAGE: "rnc:manage",
  AUDIT_VIEW: "audit:view",
  ADMIN_ACCESS: "admin:access",
  ADMIN_DASHBOARD_VIEW: "admin:dashboard:view",
  USERS_VIEW: "users:view",
  USERS_MANAGE: "users:manage",
  ADMINS_VIEW: "admins:view",
  ADMINS_MANAGE: "admins:manage",
  DEPARTMENTS_VIEW: "departments:view",
  DEPARTMENTS_MANAGE: "departments:manage",
  SETTINGS_VIEW: "settings:view",
  SYSTEM_LOGS_VIEW: "system_logs:view"
};

export function normalizeRole(role) {
  const normalized = String(role || "").trim().toUpperCase();
  if (normalized === ROLES.SUPER_ADMIN) return ROLES.SUPER_ADMIN;
  if (normalized === ROLES.ADMIN) return ROLES.ADMIN;
  return ROLES.USER;
}

export function hasPermission(user, permission) {
  if (!permission) return true;
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

export function canAccessAdmin(user) {
  return hasPermission(user, PERMISSIONS.ADMIN_ACCESS);
}

export function getDefaultRouteForUser(user) {
  if (canAccessAdmin(user)) {
    return "/admin";
  }

  if (hasPermission(user, PERMISSIONS.DASHBOARD_VIEW)) {
    return "/dashboard";
  }

  return "/";
}
