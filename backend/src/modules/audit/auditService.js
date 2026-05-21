import { getSupabaseAdmin, throwIfSupabaseError } from "../../shared/database/supabaseStore.js";
import { buildSupplierCompanyWhere } from "../../shared/auth/dataScope.js";

const AUDIT_USER_COLUMNS = "id,email,name";
const AUDIT_LOG_COLUMNS = "id,userId,action,entity,entityId,details,createdAt";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const AUDIT_FETCH_CAP = 3000;

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
    console.error("Falha ao registrar log de auditoria:", error?.message || error);
  });
}

function normalizeSearchTerm(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function matchesSearch(entry, search) {
  if (!search) {
    return true;
  }

  const createdAtLabel = entry.createdAt
    ? new Date(entry.createdAt).toLocaleString("pt-BR").toLowerCase()
    : "";

  const haystack = [
    createdAtLabel,
    entry.user?.email,
    entry.user?.name,
    entry.action,
    entry.entity,
    entry.details,
    entry.entityId != null ? String(entry.entityId) : ""
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
}

export async function listByCompany(scope, options = {}) {
  const client = getSupabaseAdmin();
  const companyFilter = buildSupplierCompanyWhere(scope).supplier;
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(options.pageSize, 10) || DEFAULT_PAGE_SIZE)
  );
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const search = normalizeSearchTerm(options.search);

  let userQuery = client.from("User").select(AUDIT_USER_COLUMNS);

  if (companyFilter?.companyId) {
    userQuery = userQuery.eq("companyId", companyFilter.companyId);
  }

  const users = throwIfSupabaseError(await userQuery, "listar usuarios para auditoria");
  const userIds = users.map((item) => item.id);

  if (!userIds.length) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 0
    };
  }

  const logs = throwIfSupabaseError(
    await client
      .from("AuditLog")
      .select(AUDIT_LOG_COLUMNS)
      .in("userId", userIds)
      .order("createdAt", { ascending: false })
      .range(0, AUDIT_FETCH_CAP - 1),
    "listar logs de auditoria"
  );

  const userMap = new Map(users.map((item) => [item.id, item]));

  const enriched = logs.map((item) => ({
    ...item,
    user: userMap.get(item.userId) || null
  }));

  const filtered = search ? enriched.filter((item) => matchesSearch(item, search)) : enriched;
  const total = filtered.length;
  const totalPages = total ? Math.ceil(total / pageSize) : 0;
  const safePage = totalPages ? Math.min(page, totalPages) : 1;
  const offset = (safePage - 1) * pageSize;
  const items = filtered.slice(offset, offset + pageSize);

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages
  };
}
