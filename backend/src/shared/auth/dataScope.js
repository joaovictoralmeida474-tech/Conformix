import { ROLES, normalizeRole } from "./permissions.js";

function asCompanyId(scope) {
  if (scope && typeof scope === "object") {
    const parsed = Number(scope.companyId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  const parsed = Number(scope);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isSuperAdminScope(scope) {
  return Boolean(scope && typeof scope === "object" && normalizeRole(scope.role) === ROLES.SUPER_ADMIN);
}

export function buildCompanyWhere(scope, extra = {}) {
  if (isSuperAdminScope(scope)) {
    return { ...extra };
  }

  return {
    ...extra,
    companyId: asCompanyId(scope)
  };
}

export function buildSupplierCompanyWhere(scope, extra = {}) {
  if (isSuperAdminScope(scope)) {
    return { ...extra };
  }

  return {
    ...extra,
    supplier: {
      companyId: asCompanyId(scope)
    }
  };
}

export function resolveTargetCompanyId(scope, explicitCompanyId = null) {
  const normalizedExplicit = Number(explicitCompanyId);

  if (Number.isInteger(normalizedExplicit) && normalizedExplicit > 0) {
    return normalizedExplicit;
  }

  const scopedCompanyId = asCompanyId(scope);

  if (Number.isInteger(scopedCompanyId) && scopedCompanyId > 0) {
    return scopedCompanyId;
  }

  throw new Error("Empresa obrigatoria para esta operacao");
}
