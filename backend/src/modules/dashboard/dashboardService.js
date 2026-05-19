import { applyCompanyScope, getSupplierIdsForScope } from "../../shared/database/supabaseScope.js";
import { getSupabaseAdmin, throwIfSupabaseError } from "../../shared/database/supabaseStore.js";
import { isSuperAdminScope } from "../../shared/auth/dataScope.js";

const DASHBOARD_SUPPLIER_COLUMNS = "id,name,status,nextReview,supplierType,score,riskIndex,companyId";
const DASHBOARD_DOCUMENT_COLUMNS = "supplierId,expiresAt";
const DASHBOARD_RNC_COLUMNS = "id,supplierId,status,deadline,createdAt";
const DASHBOARD_CHART_LIMIT = Number(process.env.DASHBOARD_CHART_LIMIT || 40);
const DASHBOARD_CACHE_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS || 30_000);

const dashboardCache = new Map();

function getDashboardCacheKey(scope) {
  if (isSuperAdminScope(scope)) {
    return "dashboard:super-admin";
  }

  const companyId = Number(scope?.companyId || 0);
  return `dashboard:company:${Number.isInteger(companyId) && companyId > 0 ? companyId : "unknown"}`;
}

function getCachedDashboard(cacheKey) {
  const cached = dashboardCache.get(cacheKey);

  if (!cached || cached.expiresAt <= Date.now()) {
    dashboardCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

function setCachedDashboard(cacheKey, data) {
  if (DASHBOARD_CACHE_TTL_MS <= 0) {
    return;
  }

  dashboardCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS
  });
}

function isOverdue(value) {
  return value ? new Date(value).getTime() < Date.now() : false;
}

function buildAlerts(suppliers, rncs) {
  const alerts = [];

  for (const supplier of suppliers) {
    if (supplier.status === "BLOQUEADO") {
      alerts.push({
        type: "fornecedor_bloqueado",
        supplierId: supplier.id,
        message: `O fornecedor ${supplier.name} foi bloqueado e precisa de tratativa.`
      });
    }

    if (supplier.nextReview && isOverdue(supplier.nextReview)) {
      alerts.push({
        type: "avaliacao_vencida",
        supplierId: supplier.id,
        message: `A avaliacao do fornecedor ${supplier.name} esta vencida.`
      });
    }

    const expiringDocuments = (supplier.documents || []).filter((item) => {
      if (!item.expiresAt) return false;
      const diff = new Date(item.expiresAt).getTime() - Date.now();
      return diff >= 0 && diff <= 15 * 24 * 60 * 60 * 1000;
    });

    const expiredDocuments = (supplier.documents || []).filter((item) => {
      if (!item.expiresAt) return false;
      return new Date(item.expiresAt).getTime() < Date.now();
    });

    if (expiredDocuments.length) {
      alerts.push({
        type: "documento_vencido",
        supplierId: supplier.id,
        message: `${expiredDocuments.length} documento(s) do fornecedor ${supplier.name} estao vencidos.`
      });
    }

    if (expiringDocuments.length) {
      alerts.push({
        type: "documento_vencendo",
        supplierId: supplier.id,
        message: `${expiringDocuments.length} documento(s) do fornecedor ${supplier.name} vencem em breve.`
      });
    }
  }

  for (const item of rncs) {
    if (item.deadline && isOverdue(item.deadline) && item.status === "ABERTA") {
      alerts.push({
        type: "rnc_vencida",
        supplierId: item.supplierId,
        message: `A RNC ${item.id} do fornecedor ${item.supplier?.name || item.supplierId} esta com prazo vencido.`
      });
    }
  }

  return alerts;
}

async function loadDashboardSuppliers(scope) {
  const client = getSupabaseAdmin();
  let query = client.from("Supplier").select(DASHBOARD_SUPPLIER_COLUMNS).order("name", { ascending: true });
  query = applyCompanyScope(query, scope);

  const suppliers = throwIfSupabaseError(await query, "listar fornecedores do dashboard");

  if (!suppliers.length) {
    return [];
  }

  const supplierIds = suppliers.map((item) => item.id);
  const documents = throwIfSupabaseError(
    await client.from("SupplierDocument").select(DASHBOARD_DOCUMENT_COLUMNS).in("supplierId", supplierIds),
    "listar documentos do dashboard"
  );

  const documentsBySupplier = new Map();

  for (const document of documents) {
    if (!documentsBySupplier.has(document.supplierId)) {
      documentsBySupplier.set(document.supplierId, []);
    }
    documentsBySupplier.get(document.supplierId).push(document);
  }

  return suppliers.map((supplier) => ({
    ...supplier,
    documents: documentsBySupplier.get(supplier.id) || []
  }));
}

async function loadDashboardRncs(scope) {
  const client = getSupabaseAdmin();
  let query = client.from("RNC").select(DASHBOARD_RNC_COLUMNS).order("createdAt", { ascending: false });

  if (!isSuperAdminScope(scope)) {
    const supplierIds = await getSupplierIdsForScope(scope);

    if (!supplierIds.length) {
      return [];
    }

    query = query.in("supplierId", supplierIds);
  }

  const rncs = throwIfSupabaseError(await query, "listar rnc do dashboard");

  if (!rncs.length) {
    return [];
  }

  const supplierIds = [...new Set(rncs.map((item) => item.supplierId))];
  const suppliers = throwIfSupabaseError(
    await client.from("Supplier").select("id,name").in("id", supplierIds),
    "listar fornecedores das rnc"
  );
  const supplierMap = new Map(suppliers.map((item) => [item.id, item]));

  return rncs.map((item) => ({
    ...item,
    supplier: supplierMap.get(item.supplierId) || null
  }));
}

async function buildMetrics(scope) {
  const [suppliers, openRncs] = await Promise.all([
    loadDashboardSuppliers(scope),
    loadDashboardRncs(scope)
  ]);

  const total = suppliers.length;
  const criticalSuppliers = suppliers.filter((item) => item.supplierType === "CRITICO").length;
  const bloqueados = suppliers.filter((item) => item.status === "BLOQUEADO").length;
  const rnc = openRncs.filter((item) => item.status === "ABERTA").length;
  const expiring = suppliers.filter((item) => {
    if (!item.nextReview) return false;
    const diff = new Date(item.nextReview).getTime() - Date.now();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const scores = suppliers
    .map((item) => Number(item.score || 0))
    .filter((value) => !Number.isNaN(value));
  const averageScore = scores.length
    ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2))
    : 0;

  const ranking = [...suppliers]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: item.name,
      score: item.score,
      riskIndex: item.riskIndex,
      status: item.status
    }));

  const alerts = buildAlerts(suppliers, openRncs).slice(0, 10);
  const openRncItems = openRncs
    .filter((item) => item.status === "ABERTA")
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      deadline: item.deadline,
      status: item.status,
      supplierId: item.supplierId,
      supplier: item.supplier
    }));

  return {
    total,
    criticalSuppliers,
    bloqueados,
    rnc,
    expiring,
    averageScore,
    ranking,
    alerts,
    openRncs: openRncItems,
    overdueRncs: openRncs.filter((item) => item.deadline && isOverdue(item.deadline) && item.status === "ABERTA"),
    labels: suppliers.slice(0, DASHBOARD_CHART_LIMIT).map((item) => item.name),
    scores: suppliers.slice(0, DASHBOARD_CHART_LIMIT).map((item) => Number(item.score || 0)),
    risks: suppliers.slice(0, DASHBOARD_CHART_LIMIT).map((item) => Number(item.riskIndex || 0))
  };
}

export async function getMetrics(scope) {
  const cacheKey = getDashboardCacheKey(scope);
  const cached = getCachedDashboard(cacheKey);

  if (cached) {
    return cached;
  }

  const data = await buildMetrics(scope);
  setCachedDashboard(cacheKey, data);
  return data;
}
