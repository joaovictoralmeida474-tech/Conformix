const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER'
};

const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard:view',
  SUPPLIERS_VIEW: 'suppliers:view',
  SUPPLIERS_MANAGE: 'suppliers:manage',
  SUPPLIERS_EVALUATE: 'suppliers:evaluate',
  SUPPLIERS_EXPORT: 'suppliers:export',
  CATEGORIES_VIEW: 'categories:view',
  CATEGORIES_MANAGE: 'categories:manage',
  RNC_VIEW: 'rnc:view',
  RNC_MANAGE: 'rnc:manage',
  AUDIT_VIEW: 'audit:view',
  ADMIN_ACCESS: 'admin:access',
  ADMIN_DASHBOARD_VIEW: 'admin:dashboard:view',
  USERS_VIEW: 'users:view',
  USERS_MANAGE: 'users:manage',
  ADMINS_VIEW: 'admins:view',
  ADMINS_MANAGE: 'admins:manage',
  DEPARTMENTS_VIEW: 'departments:view',
  DEPARTMENTS_MANAGE: 'departments:manage',
  SETTINGS_VIEW: 'settings:view',
  SYSTEM_LOGS_VIEW: 'system_logs:view'
};

function normalizeRole(role) {
  const normalized = String(role || '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();

  if (normalized === ROLES.SUPER_ADMIN) return ROLES.SUPER_ADMIN;
  if (normalized === ROLES.ADMIN) return ROLES.ADMIN;
  return ROLES.USER;
}

function parseConfiguredEmails(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getSuperAdminEmails() {
  return Array.from(
    new Set(
      [
        'superadmin@integraxx.local',
        'superadmin@conformix.local',
        String(process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL || '').trim().toLowerCase(),
        ...parseConfiguredEmails(process.env.SUPER_ADMIN_EMAILS)
      ].filter(Boolean)
    )
  );
}

function resolveRoleByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const superAdminEmails = getSuperAdminEmails();
  const adminEmails = parseConfiguredEmails(process.env.ADMIN_EMAILS);

  if (superAdminEmails.includes(normalizedEmail)) {
    return ROLES.SUPER_ADMIN;
  }

  if (adminEmails.includes(normalizedEmail)) {
    return ROLES.ADMIN;
  }

  return null;
}

function getPermissionsForRole(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === ROLES.SUPER_ADMIN) {
    return Object.values(PERMISSIONS);
  }

  if (normalizedRole === ROLES.ADMIN) {
    return [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SUPPLIERS_VIEW,
      PERMISSIONS.SUPPLIERS_MANAGE,
      PERMISSIONS.SUPPLIERS_EVALUATE,
      PERMISSIONS.SUPPLIERS_EXPORT,
      PERMISSIONS.CATEGORIES_VIEW,
      PERMISSIONS.CATEGORIES_MANAGE,
      PERMISSIONS.RNC_VIEW,
      PERMISSIONS.RNC_MANAGE,
      PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.ADMIN_DASHBOARD_VIEW,
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.DEPARTMENTS_VIEW,
      PERMISSIONS.SETTINGS_VIEW
    ];
  }

  return [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.SUPPLIERS_EVALUATE,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.RNC_VIEW
  ];
}

function extractRoleFromSupabaseUser(user) {
  return (
    resolveRoleByEmail(user?.email) ||
    normalizeRole(
    user?.app_metadata?.role ||
      user?.user_metadata?.role ||
      user?.role ||
      user?.app_metadata?.user_role ||
      user?.user_metadata?.user_role
    )
  );
}

function buildAuthUser({ localUserId, supabaseUser }) {
  const role = extractRoleFromSupabaseUser(supabaseUser);

  return {
    id: localUserId,
    email: supabaseUser.email,
    role,
    permissions: getPermissionsForRole(role),
    supabaseId: supabaseUser.id
  };
}

module.exports = {
  ROLES,
  PERMISSIONS,
  normalizeRole,
  resolveRoleByEmail,
  getPermissionsForRole,
  extractRoleFromSupabaseUser,
  buildAuthUser
};
