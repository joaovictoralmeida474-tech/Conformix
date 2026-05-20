import { getSupabaseAdmin, throwIfSupabaseError } from "../../shared/database/supabaseStore.js";
import { buildSupplierCompanyWhere } from "../../shared/auth/dataScope.js";

const AUDIT_USER_COLUMNS = "id,email,name";
const AUDIT_LOG_COLUMNS = "id,userId,action,entity,entityId,details,createdAt";
const DEFAULT_AUDIT_LIMIT = 100;
const MAX_AUDIT_LIMIT = 200;

async function writeAuditLog(userId, action, meta = {}) {
  const client = getSupabaseAdmin();
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return;
  }

  throwIfSupabaseError(
    await client.from("AuditLog").insert({
      userId: normalizedUserId,
      action,
      entity: meta.entity || "sistema",
      entityId: meta.entityId ? Number(meta.entityId) : null,
      details: meta.details || null
    }),
    "registrar log de auditoria"
  );
}

export function log(userId, action, meta = {}) {
  void writeAuditLog(userId, action, meta).catch((error) => {
    console.error("Falha ao registrar auditoria:", error?.message || error);
  });
}

export async function listByCompany(scope, options = {}) {
  const client = getSupabaseAdmin();
  const companyFilter = buildSupplierCompanyWhere(scope).supplier;
  const limit = Math.min(
    MAX_AUDIT_LIMIT,
    Math.max(1, Number.parseInt(options.limit, 10) || DEFAULT_AUDIT_LIMIT)
  );
  const offset = Math.max(0, Number.parseInt(options.offset, 10) || 0);

  let userQuery = client.from("User").select(AUDIT_USER_COLUMNS);

  if (companyFilter?.companyId) {
    userQuery = userQuery.eq("companyId", companyFilter.companyId);
  }

  const users = throwIfSupabaseError(await userQuery, "listar usuarios para auditoria");
  const userIds = users.map((item) => item.id);

  if (!userIds.length) {
    return [];
  }

  const logs = throwIfSupabaseError(
    await client
      .from("AuditLog")
      .select(AUDIT_LOG_COLUMNS)
      .in("userId", userIds)
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1),
    "listar logs de auditoria"
  );

  const userMap = new Map(users.map((item) => [item.id, item]));

  return logs.map((item) => ({
    ...item,
    user: userMap.get(item.userId) || null
  }));
}
