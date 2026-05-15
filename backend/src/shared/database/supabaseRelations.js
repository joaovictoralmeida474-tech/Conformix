import { getSupabaseAdmin, throwIfSupabaseError } from "./supabaseStore.js";

export async function loadCategoryBundle(categoryId) {
  if (!categoryId) {
    return null;
  }

  const client = getSupabaseAdmin();
  const category = throwIfSupabaseError(
    await client.from("Category").select("*").eq("id", Number(categoryId)).maybeSingle(),
    "buscar categoria"
  );

  if (!category) {
    return null;
  }

  const [questions, documents] = await Promise.all([
    throwIfSupabaseError(
      await client
        .from("CategoryQuestion")
        .select("*")
        .eq("categoryId", category.id)
        .order("sortOrder", { ascending: true }),
      "listar perguntas da categoria"
    ),
    throwIfSupabaseError(
      await client
        .from("CategoryRequiredDocument")
        .select("*")
        .eq("categoryId", category.id)
        .order("sortOrder", { ascending: true }),
      "listar documentos da categoria"
    )
  ]);

  return { ...category, questions, documents };
}

export async function loadSupplierGraph(supplierRow) {
  if (!supplierRow) {
    return null;
  }

  const client = getSupabaseAdmin();
  const [category, documents, rncs, evaluations] = await Promise.all([
    loadCategoryBundle(supplierRow.categoryId),
    throwIfSupabaseError(
      await client.from("SupplierDocument").select("*").eq("supplierId", supplierRow.id),
      "listar documentos do fornecedor"
    ),
    throwIfSupabaseError(
      await client
        .from("RNC")
        .select("*")
        .eq("supplierId", supplierRow.id)
        .order("createdAt", { ascending: false }),
      "listar rnc do fornecedor"
    ),
    throwIfSupabaseError(
      await client
        .from("Evaluation")
        .select("*")
        .eq("supplierId", supplierRow.id)
        .order("evaluationDate", { ascending: false })
        .order("id", { ascending: false }),
      "listar avaliacoes do fornecedor"
    )
  ]);

  const evaluatorIds = [...new Set(evaluations.map((item) => item.evaluatorId).filter(Boolean))];
  let evaluators = [];

  if (evaluatorIds.length) {
    evaluators = throwIfSupabaseError(
      await client.from("User").select("id,email,name").in("id", evaluatorIds),
      "listar avaliadores"
    );
  }

  const evaluatorMap = new Map(evaluators.map((item) => [item.id, item]));
  const evaluationIds = evaluations.map((item) => item.id);
  let answerItems = [];

  if (evaluationIds.length) {
    answerItems = throwIfSupabaseError(
      await client
        .from("EvaluationAnswer")
        .select("*")
        .in("evaluationId", evaluationIds)
        .order("sortOrder", { ascending: true }),
      "listar respostas das avaliacoes"
    );
  }

  const answersByEvaluation = new Map();

  for (const answer of answerItems) {
    if (!answersByEvaluation.has(answer.evaluationId)) {
      answersByEvaluation.set(answer.evaluationId, []);
    }
    answersByEvaluation.get(answer.evaluationId).push(answer);
  }

  return {
    ...supplierRow,
    category,
    documents,
    rncs,
    evaluations: evaluations.map((evaluation) => ({
      ...evaluation,
      evaluator: evaluatorMap.get(evaluation.evaluatorId) || null,
      answerItems: answersByEvaluation.get(evaluation.id) || []
    }))
  };
}
