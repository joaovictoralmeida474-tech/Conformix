import { getSupabaseAdmin, throwIfSupabaseError } from "../../shared/database/supabaseStore.js";
import { buildSupplierCompanyWhere } from "../../shared/auth/dataScope.js";

export async function log(userId, action, meta = {}) {
  const client = getSupabaseAdmin();

  throwIfSupabaseError(
    await client.from("AuditLog").insert({
      userId,
      action,
      entity: meta.entity || "sistema",
      entityId: meta.entityId ? Number(meta.entityId) : null,
      details: meta.details || null
    }),
    "registrar log de auditoria"
  );
}

export async function listByCompany(scope) {
  const client = getSupabaseAdmin();
  const companyFilter = buildSupplierCompanyWhere(scope).supplier;

  let userQuery = client.from("User").select("id");

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
      .select("*")
      .in("userId", userIds)
      .order("createdAt", { ascending: false }),
    "listar logs de auditoria"
  );

  const userMap = new Map(users.map((item) => [item.id, item]));

  return logs.map((item) => ({
    ...item,
    user: userMap.get(item.userId) || null
  }));
}
