import { invalidateDashboardMetricsCache } from "../dashboard/dashboardService.js";
import { isSuperAdminScope } from "../../shared/auth/dataScope.js";
import * as repo from "../../shared/database/supabaseRepo.js";
import { getSupplierIdsForScope } from "../../shared/database/supabaseScope.js";
import { getSupabaseAdmin, throwIfSupabaseError } from "../../shared/database/supabaseStore.js";

const RNC_COLUMNS =
  "id,supplierId,evaluationId,status,actionPlan,description,cause,correctiveAction,responsible,deadline,treatedAt,createdAt";

function addThirtyDays(baseDate) {
  const deadline = new Date(baseDate);
  deadline.setDate(deadline.getDate() + 30);
  return deadline;
}

function mapRncForClient(item) {
  if (!item) {
    return item;
  }

  return {
    ...item,
    treatmentDate: item.treatedAt ?? item.treatmentDate ?? null
  };
}

async function loadRncGraph(rncRow) {
  if (!rncRow) {
    return null;
  }

  const client = getSupabaseAdmin();
  const [supplier, evaluation] = await Promise.all([
    throwIfSupabaseError(
      await client
        .from("Supplier")
        .select("id,name,status,supplierType,riskIndex")
        .eq("id", rncRow.supplierId)
        .maybeSingle(),
      "buscar fornecedor da rnc"
    ),
    rncRow.evaluationId
      ? throwIfSupabaseError(
          await client
            .from("Evaluation")
            .select("id,score,classification,evaluationDate")
            .eq("id", rncRow.evaluationId)
            .maybeSingle(),
          "buscar avaliacao da rnc"
        )
      : null
  ]);

  return mapRncForClient({
    ...rncRow,
    supplier,
    evaluation
  });
}

async function listRncRowsForScope(scope) {
  const client = getSupabaseAdmin();
  let query = client.from("RNC").select(RNC_COLUMNS).order("createdAt", { ascending: false });

  if (!isSuperAdminScope(scope)) {
    const supplierIds = await getSupplierIdsForScope(scope);

    if (!supplierIds.length) {
      return [];
    }

    query = query.in("supplierId", supplierIds);
  }

  return throwIfSupabaseError(await query, "listar rnc");
}

async function loadRncGraphs(rncRows = []) {
  if (!rncRows.length) {
    return [];
  }

  const client = getSupabaseAdmin();
  const supplierIds = [...new Set(rncRows.map((item) => item.supplierId).filter(Boolean))];
  const evaluationIds = [...new Set(rncRows.map((item) => item.evaluationId).filter(Boolean))];

  const [suppliers, evaluations] = await Promise.all([
    supplierIds.length
      ? throwIfSupabaseError(
          await client
            .from("Supplier")
            .select("id,name,status,supplierType,riskIndex")
            .in("id", supplierIds),
          "listar fornecedores das rnc"
        )
      : [],
    evaluationIds.length
      ? throwIfSupabaseError(
          await client
            .from("Evaluation")
            .select("id,score,classification,evaluationDate")
            .in("id", evaluationIds),
          "listar avaliacoes das rnc"
        )
      : []
  ]);

  const supplierMap = new Map(suppliers.map((item) => [item.id, item]));
  const evaluationMap = new Map(evaluations.map((item) => [item.id, item]));

  return rncRows.map((item) =>
    mapRncForClient({
      ...item,
      supplier: supplierMap.get(item.supplierId) || null,
      evaluation: evaluationMap.get(item.evaluationId) || null
    })
  );
}

async function findRncInScope(scope, id) {
  const rnc = await repo.findById("RNC", id);

  if (!rnc) {
    return null;
  }

  if (!isSuperAdminScope(scope)) {
    const supplier = await repo.findById("Supplier", rnc.supplierId);
    const companyId = Number(scope?.companyId);

    if (!supplier || Number(supplier.companyId) !== companyId) {
      return null;
    }
  }

  return rnc;
}

export async function list(scope) {
  const items = await listRncRowsForScope(scope);
  const hydrated = await loadRncGraphs(items);

  return hydrated.map((item) => {
    const withDeadline =
      !item.deadline && item.evaluation?.evaluationDate
        ? { ...item, deadline: addThirtyDays(item.evaluation.evaluationDate) }
        : item;

    return mapRncForClient(withDeadline);
  });
}

export async function update(scope, id, data) {
  const existing = await findRncInScope(scope, id);

  if (!existing) {
    throw new Error("RNC nao encontrada");
  }

  const treatmentDateValue = data.treatedAt ?? data.treatmentDate;

  await repo.updateRow("RNC", id, {
    status: data.status || existing.status,
    actionPlan: data.actionPlan ?? existing.actionPlan,
    description: data.description ?? existing.description,
    cause: data.cause ?? existing.cause,
    correctiveAction: data.correctiveAction ?? existing.correctiveAction,
    responsible: data.responsible ?? existing.responsible,
    deadline: data.deadline ? new Date(data.deadline) : existing.deadline,
    treatedAt: treatmentDateValue ? new Date(treatmentDateValue) : existing.treatedAt
  });

  if (data.supplierStatusAction) {
    await repo.updateRow("Supplier", existing.supplierId, {
      status:
        String(data.supplierStatusAction).toUpperCase() === "ATIVO" ||
        String(data.supplierStatusAction).toUpperCase() === "ACTIVE"
          ? "ATIVO"
          : "BLOQUEADO"
    });
  }

  invalidateDashboardMetricsCache();

  return loadRncGraph(await repo.findById("RNC", id));
}
