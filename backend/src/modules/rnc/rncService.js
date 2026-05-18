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

  return {
    ...rncRow,
    supplier,
    evaluation
  };
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
  const hydrated = await Promise.all(items.map((item) => loadRncGraph(item)));

  const missingDeadline = hydrated.filter(
    (item) => !item.deadline && item.evaluation?.evaluationDate
  );

  if (missingDeadline.length) {
    await Promise.all(
      missingDeadline.map((item) =>
        repo.updateRow("RNC", item.id, {
          deadline: addThirtyDays(item.evaluation.evaluationDate)
        })
      )
    );

    return hydrated.map((item) =>
      !item.deadline && item.evaluation?.evaluationDate
        ? { ...item, deadline: addThirtyDays(item.evaluation.evaluationDate) }
        : item
    );
  }

  return hydrated;
}

export async function update(scope, id, data) {
  const existing = await findRncInScope(scope, id);

  if (!existing) {
    throw new Error("RNC nao encontrada");
  }

  await repo.updateRow("RNC", id, {
    status: data.status || existing.status,
    actionPlan: data.actionPlan ?? existing.actionPlan,
    description: data.description ?? existing.description,
    cause: data.cause ?? existing.cause,
    correctiveAction: data.correctiveAction ?? existing.correctiveAction,
    responsible: data.responsible ?? existing.responsible,
    deadline: data.deadline ? new Date(data.deadline) : existing.deadline,
    treatedAt: data.treatedAt ? new Date(data.treatedAt) : existing.treatedAt
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

  return loadRncGraph(await repo.findById("RNC", id));
}
