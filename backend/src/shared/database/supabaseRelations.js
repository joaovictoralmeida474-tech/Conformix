import { getSupabaseAdmin, throwIfSupabaseError } from "./supabaseStore.js";

const CATEGORY_COLUMNS = "id,slug,name,description,active,companyId";
const CATEGORY_QUESTION_COLUMNS = "id,categoryId,prompt,sortOrder,active";
const CATEGORY_DOCUMENT_COLUMNS = "id,categoryId,name,sortOrder,active";
const SUPPLIER_DOCUMENT_COLUMNS = "id,supplierId,requiredDocumentId,documentName,filename,originalName,expiresAt";
const RNC_COLUMNS =
  "id,supplierId,evaluationId,status,actionPlan,description,cause,correctiveAction,responsible,deadline,treatedAt,createdAt";
const SERVICE_INVOICE_COLUMNS =
  "id,number,series,supplierId,companyId,serviceDescription,observations,status,issueDate,competenceDate,netAmount,grossAmount,discountAmount,pdfFilename,pdfOriginalName,xmlFilename,xmlOriginalName,createdAt";
const EVALUATION_COLUMNS =
  "id,supplierId,evaluatorId,evaluationDate,invoiceNumber,observations,attachmentFilename,attachmentOriginalName,score,classification,createdAt";
const EVALUATION_ANSWER_COLUMNS = "id,evaluationId,categoryQuestionId,questionText,score,sortOrder";
const SUPPLIER_GRAPH_EVALUATION_LIMIT = Number(process.env.SUPPLIER_GRAPH_EVALUATION_LIMIT || 25);
const SUPPLIER_GRAPH_RNC_LIMIT = Number(process.env.SUPPLIER_GRAPH_RNC_LIMIT || 50);
const SUPPLIER_GRAPH_INVOICE_LIMIT = Number(process.env.SUPPLIER_GRAPH_INVOICE_LIMIT || 50);

export async function loadCategoryBundle(categoryId) {
  if (!categoryId) {
    return null;
  }

  const client = getSupabaseAdmin();
  const category = throwIfSupabaseError(
    await client.from("Category").select(CATEGORY_COLUMNS).eq("id", Number(categoryId)).maybeSingle(),
    "buscar categoria"
  );

  if (!category) {
    return null;
  }

  const [questions, documents] = await Promise.all([
    throwIfSupabaseError(
      await client
        .from("CategoryQuestion")
        .select(CATEGORY_QUESTION_COLUMNS)
        .eq("categoryId", category.id)
        .order("sortOrder", { ascending: true }),
      "listar perguntas da categoria"
    ),
    throwIfSupabaseError(
      await client
        .from("CategoryRequiredDocument")
        .select(CATEGORY_DOCUMENT_COLUMNS)
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
  const [category, documents, rncs, evaluations, serviceInvoices] = await Promise.all([
    loadCategoryBundle(supplierRow.categoryId),
    throwIfSupabaseError(
      await client.from("SupplierDocument").select(SUPPLIER_DOCUMENT_COLUMNS).eq("supplierId", supplierRow.id),
      "listar documentos do fornecedor"
    ),
    throwIfSupabaseError(
      await client
        .from("RNC")
        .select(RNC_COLUMNS)
        .eq("supplierId", supplierRow.id)
        .order("createdAt", { ascending: false })
        .limit(SUPPLIER_GRAPH_RNC_LIMIT),
      "listar rnc do fornecedor"
    ),
    throwIfSupabaseError(
      await client
        .from("Evaluation")
        .select(EVALUATION_COLUMNS)
        .eq("supplierId", supplierRow.id)
        .order("evaluationDate", { ascending: false })
        .order("id", { ascending: false })
        .limit(SUPPLIER_GRAPH_EVALUATION_LIMIT),
      "listar avaliacoes do fornecedor"
    ),
    throwIfSupabaseError(
      await client
        .from("ServiceInvoice")
        .select(SERVICE_INVOICE_COLUMNS)
        .eq("supplierId", supplierRow.id)
        .order("issueDate", { ascending: false })
        .limit(SUPPLIER_GRAPH_INVOICE_LIMIT),
      "listar notas fiscais do fornecedor"
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
        .select(EVALUATION_ANSWER_COLUMNS)
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
    serviceInvoices,
    evaluations: evaluations.map((evaluation) => ({
      ...evaluation,
      evaluator: evaluatorMap.get(evaluation.evaluatorId) || null,
      answerItems: answersByEvaluation.get(evaluation.id) || []
    }))
  };
}
