import { isSuperAdminScope } from "../auth/dataScope.js";
import { getSupabaseAdmin, throwIfSupabaseError } from "./supabaseStore.js";

export function getScopedCompanyId(scope) {
  if (isSuperAdminScope(scope)) {
    return null;
  }

  const companyId = Number(scope?.companyId);
  return Number.isInteger(companyId) && companyId > 0 ? companyId : null;
}

export function applyCompanyScope(query, scope, column = "companyId") {
  const companyId = getScopedCompanyId(scope);

  if (companyId) {
    return query.eq(column, companyId);
  }

  return query;
}

export async function getSupplierIdsForScope(scope) {
  const db = getSupabaseAdmin();

  let query = db.from("Supplier").select("id");
  query = applyCompanyScope(query, scope);

  const rows = throwIfSupabaseError(await query, "listar fornecedores do escopo");
  return rows.map((item) => item.id);
}
