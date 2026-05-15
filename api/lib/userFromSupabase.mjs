import {
  ROLE_PERMISSION_MAP,
  ROLES,
  normalizeRole
} from "../../backend/src/shared/auth/permissions.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getSuperAdminAliases() {
  const configured = normalizeEmail(process.env.SUPER_ADMIN_EMAIL);
  return new Set(
    [
      "superadmin@conformix.local",
      "joaovictoralmeida474@gmail.com",
      configured
    ].filter(Boolean)
  );
}

function extractSupabaseMetadataValue(user, key) {
  return user?.app_metadata?.[key] ?? user?.user_metadata?.[key] ?? null;
}

function deriveDisplayName(supabaseUser) {
  const metadataName =
    supabaseUser?.app_metadata?.name ?? supabaseUser?.user_metadata?.name ?? "";

  if (String(metadataName).trim()) {
    return String(metadataName).trim();
  }

  const email = normalizeEmail(supabaseUser?.email);

  if (!email.includes("@")) {
    return "Usuario";
  }

  const [localPart] = email.split("@");
  return localPart.trim() || "Usuario";
}

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function buildUserFromSupabase(supabaseUser) {
  const normalizedEmail = normalizeEmail(supabaseUser?.email);
  const aliases = getSuperAdminAliases();
  const isSuperAdminAlias = aliases.has(normalizedEmail);
  const role = isSuperAdminAlias
    ? ROLES.SUPER_ADMIN
    : normalizeRole(extractSupabaseMetadataValue(supabaseUser, "role") || ROLES.USER);
  const permissions = ROLE_PERMISSION_MAP[role] || [];
  const name =
    String(extractSupabaseMetadataValue(supabaseUser, "name") ?? deriveDisplayName(supabaseUser)).trim() ||
    "Usuario";

  return {
    id: String(supabaseUser?.id || normalizedEmail || "supabase-user"),
    name,
    email: normalizedEmail,
    role,
    active: true,
    companyId:
      role === ROLES.SUPER_ADMIN
        ? null
        : toPositiveInt(extractSupabaseMetadataValue(supabaseUser, "companyId")),
    departmentId:
      role === ROLES.SUPER_ADMIN
        ? null
        : toPositiveInt(extractSupabaseMetadataValue(supabaseUser, "departmentId")),
    company: null,
    department: null,
    permissions,
    permissionsSource: "role"
  };
}
