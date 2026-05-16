import ExcelJS from "exceljs";
import axios from "axios";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

import * as repo from "../../shared/database/supabaseRepo.js";
import { applyCompanyScope } from "../../shared/database/supabaseScope.js";
import { loadSupplierGraph } from "../../shared/database/supabaseRelations.js";
import { getSupabaseAdmin, throwIfSupabaseError } from "../../shared/database/supabaseStore.js";
import { checkExpiry } from "../../shared/utils/checkExpiry.js";
import { getEvaluationUploadsRoot, getSupplierUploadsRoot } from "../../shared/uploads.js";
import {
  isSuperAdminScope,
  resolveTargetCompanyId
} from "../../shared/auth/dataScope.js";

const supplierUploadsRoot = getSupplierUploadsRoot();
const evaluationUploadsRoot = getEvaluationUploadsRoot();
const SUPPLIER_DOCUMENTS_BUCKET = "supplier-documents";

const SUPPLIER_TYPE_CADENCE = {
  CRITICO: 30,
  ALTO: 45,
  INTERMEDIARIO: 90,
  PADRAO: 120,
  BASICO: 180,
  NAO_CRITICO: 365
};

function normalizeCNPJ(value) {
  return String(value || "").replace(/\D/g, "");
}

function parseNullableDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "BLOCKED" || normalized === "BLOQUEADO") {
    return "BLOQUEADO";
  }
  return "ATIVO";
}

async function ensureSupplierDocumentsBucket(client) {
  const existing = await client.storage.getBucket(SUPPLIER_DOCUMENTS_BUCKET);

  if (!existing.error) {
    return true;
  }

  const created = await client.storage.createBucket(SUPPLIER_DOCUMENTS_BUCKET, {
    public: false
  });

  return !created.error;
}

async function uploadSupplierDocumentToStorage(supplierId, file) {
  if (!file?.path || !file?.filename) {
    return null;
  }

  try {
    const client = getSupabaseAdmin();
    const hasBucket = await ensureSupplierDocumentsBucket(client);

    if (!hasBucket) {
      return null;
    }

    const storagePath = `${Number(supplierId)}/${file.filename}`;
    const buffer = await fsPromises.readFile(file.path);
    const result = await client.storage
      .from(SUPPLIER_DOCUMENTS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.mimetype || "application/pdf",
        upsert: true
      });

    if (result.error) {
      console.error("Falha ao enviar documento para o Supabase Storage:", result.error.message);
      return null;
    }

    return storagePath;
  } catch (error) {
    console.error("Falha ao preparar upload do documento:", error?.message || error);
    return null;
  }
}

async function downloadSupplierDocumentFromStorage(supplierId, filename) {
  const client = getSupabaseAdmin();
  const candidates = [
    String(filename || "").trim(),
    `${Number(supplierId)}/${String(filename || "").trim()}`
  ].filter(Boolean);

  for (const candidate of [...new Set(candidates)]) {
    const result = await client.storage
      .from(SUPPLIER_DOCUMENTS_BUCKET)
      .download(candidate);

    if (result.error || !result.data) {
      continue;
    }

    const arrayBuffer = await result.data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  return null;
}

function normalizeSupplierType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  const aliases = {
    CRITICAL: "CRITICO",
    HIGH: "ALTO",
    INTERMEDIATE: "INTERMEDIARIO",
    STANDARD: "PADRAO",
    BASIC: "BASICO",
    NON_CRITICAL: "NAO_CRITICO"
  };

  return aliases[normalized] || normalized || "BASICO";
}

function serializeQuestion(question) {
  return {
    id: question.id,
    prompt: question.prompt,
    sortOrder: question.sortOrder,
    active: question.active
  };
}

function serializeDocumentRequirement(document) {
  return {
    id: document.id,
    name: document.name,
    sortOrder: document.sortOrder,
    active: document.active
  };
}

function summarizeDocuments(requirements = [], docs = []) {
  const mapped = new Map(
    docs
      .filter((item) => item.requiredDocumentId)
      .map((item) => [item.requiredDocumentId, item])
  );

  const summary = {
    required: requirements.length,
    attached: 0,
    valid: 0,
    expired: 0,
    missing: 0
  };

  for (const requirement of requirements) {
    const item = mapped.get(requirement.id);
    if (!item || !item.filename || !item.originalName) {
      summary.missing += 1;
      continue;
    }

    summary.attached += 1;

    if (item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) {
      summary.expired += 1;
    } else if (item.expiresAt) {
      summary.valid += 1;
    }
  }

  return summary;
}

function classifyScore(score) {
  if (score >= 90) return "Excelente";
  if (score >= 60) return "Aprovado";
  return "Critico";
}

function trendFromEvaluations(evaluations = []) {
  if (evaluations.length < 2) return "ESTAVEL";
  const [latest, previous] = evaluations;
  if ((latest.score || 0) > (previous.score || 0)) return "EM_MELHORIA";
  if ((latest.score || 0) < (previous.score || 0)) return "EM_PIORA";
  return "ESTAVEL";
}

function riskIndexForSupplier(supplier) {
  const scores = (supplier.evaluations || []).slice(0, 6).map((item) => Number(item.score || 0));
  if (!scores.length) return 0;

  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const overdueFactor =
    supplier.nextReview && new Date(supplier.nextReview).getTime() < Date.now() ? 15 : 0;
  const blockedFactor = supplier.status === "BLOQUEADO" ? 20 : 0;
  const openRncFactor = Math.min(
    25,
    (supplier.rncs || []).filter((item) => item.status === "ABERTA").length * 8
  );

  return Math.max(
    0,
    Math.min(100, Number(((100 - average) + overdueFactor + blockedFactor + openRncFactor).toFixed(2)))
  );
}

function nextReviewFromType(supplierType, lastDate) {
  if (!lastDate) return null;
  const days = SUPPLIER_TYPE_CADENCE[normalizeSupplierType(supplierType)] || 180;
  return new Date(new Date(lastDate).getTime() + days * 24 * 60 * 60 * 1000);
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeEvaluationAnswers(answers = [], supplier) {
  const questionMap = new Map(
    ((supplier.category?.questions || []).filter((item) => item.active)).map((item) => [item.id, item])
  );

  return (answers || [])
    .map((item, index) => {
      const rawScore = Number(item.score ?? item.value ?? item);
      const questionId = item.questionId ? Number(item.questionId) : null;
      const question = questionId ? questionMap.get(questionId) : null;

      if (Number.isNaN(rawScore)) return null;

      return {
        questionId,
        questionText: item.questionText || question?.prompt || `Pergunta ${index + 1}`,
        score: Math.max(0, Math.min(100, rawScore)),
        sortOrder: index + 1
      };
    })
    .filter(Boolean);
}

function serializeSupplier(supplier) {
  const requirements = (supplier.category?.documents || []).filter((item) => item.active);
  const questions = (supplier.category?.questions || []).filter((item) => item.active);
  const documentsSummary = summarizeDocuments(requirements, supplier.documents || []);

  return {
    id: supplier.id,
    name: supplier.name,
    tradeName: supplier.tradeName,
    cnpj: supplier.cnpj,
    categoryId: supplier.categoryId,
    category: supplier.category
      ? {
          id: supplier.category.id,
          slug: supplier.category.slug,
          name: supplier.category.name,
          description: supplier.category.description,
          active: supplier.category.active,
          questions: questions.map(serializeQuestion),
          documents: requirements.map(serializeDocumentRequirement)
        }
      : null,
    supplierType: supplier.supplierType,
    contact: supplier.contact,
    email: supplier.email,
    phone: supplier.phone,
    addressLine: supplier.addressLine,
    addressNumber: supplier.addressNumber,
    addressComplement: supplier.addressComplement,
    district: supplier.district,
    city: supplier.city,
    state: supplier.state,
    postalCode: supplier.postalCode,
    primaryActivity: supplier.primaryActivity,
    registrationStatus: supplier.registrationStatus,
    status: supplier.status,
    score: supplier.score,
    riskIndex: supplier.riskIndex,
    trend: supplier.trend,
    reactivationJustification: supplier.reactivationJustification,
    lastEvaluationDate: supplier.lastEvaluationDate,
    nextReview: supplier.nextReview,
    companyId: supplier.companyId,
    expiringSoon: checkExpiry(supplier.nextReview),
    openRnc: (supplier.rncs || []).filter((item) => item.status === "ABERTA").length,
    evaluations: (supplier.evaluations || []).map((evaluation) => ({
      id: evaluation.id,
      evaluationDate: evaluation.evaluationDate,
      score: evaluation.score,
      classification: evaluation.classification,
      invoiceNumber: evaluation.invoiceNumber,
      observations: evaluation.observations,
      attachmentOriginalName: evaluation.attachmentOriginalName,
      hasAttachment: Boolean(evaluation.attachmentFilename),
      evaluator: evaluation.evaluator
        ? {
            id: evaluation.evaluator.id,
            email: evaluation.evaluator.email,
            name: evaluation.evaluator.name
          }
        : null,
      answers: (evaluation.answerItems || []).map((answer) => ({
        id: answer.id,
        questionId: answer.categoryQuestionId,
        questionText: answer.questionText,
        score: answer.score,
        sortOrder: answer.sortOrder
      }))
    })),
    rncs: supplier.rncs || [],
    documents: (supplier.documents || []).map((item) => ({
      id: item.id,
      requiredDocumentId: item.requiredDocumentId,
      documentName: item.documentName,
      filename: item.filename,
      originalName: item.originalName,
      expiresAt: item.expiresAt,
      status:
        item.filename && item.originalName
          ? item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()
            ? "VENCIDO"
            : item.expiresAt
              ? "EM_DIA"
              : "ANEXADO"
          : "PENDENTE"
    })),
    documentsSummary
  };
}

async function findSupplier(scope, id) {
  const client = getSupabaseAdmin();
  let query = client.from("Supplier").select("*").eq("id", Number(id));
  query = applyCompanyScope(query, scope);

  const supplier = throwIfSupabaseError(await query.maybeSingle(), "buscar fornecedor");

  if (!supplier) {
    return null;
  }

  return loadSupplierGraph(supplier);
}

async function resolveCategoryForSupplier(scope, categoryId) {
  const normalizedCategoryId = Number(categoryId);

  if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId <= 0) {
    return null;
  }

  const category = await repo.findById("Category", normalizedCategoryId);

  if (!category) {
    throw new Error("Categoria nao encontrada");
  }

  if (!isSuperAdminScope(scope) && Number(category.companyId) !== Number(scope.companyId)) {
    throw new Error("Categoria fora do escopo do usuario");
  }

  return category;
}

async function resolveSupplierCompanyAndCategory(
  scope,
  data = {},
  fallbackCategoryId = null,
  fallbackCompanyId = null
) {
  const rawCategoryId = data.categoryId ?? fallbackCategoryId;
  const category = await resolveCategoryForSupplier(scope, rawCategoryId);
  const explicitCompanyId = Number(data.companyId);
  const hasExplicitCompanyId = Number.isInteger(explicitCompanyId) && explicitCompanyId > 0;

  if (category) {
    if (hasExplicitCompanyId && Number(category.companyId) !== explicitCompanyId) {
      throw new Error("A categoria selecionada nao pertence a empresa informada");
    }

    return {
      companyId: Number(category.companyId),
      categoryId: category.id
    };
  }

  return {
    companyId:
      Number.isInteger(Number(fallbackCompanyId)) && Number(fallbackCompanyId) > 0
        ? Number(data.companyId) > 0
          ? resolveTargetCompanyId(scope, data.companyId)
          : Number(fallbackCompanyId)
        : resolveTargetCompanyId(scope, data.companyId),
    categoryId: null
  };
}

export async function list(scope, filters = {}) {
  const client = getSupabaseAdmin();
  let query = client.from("Supplier").select("*").order("name", { ascending: true });
  query = applyCompanyScope(query, scope);

  if (filters.search) {
    query = query.ilike("name", `%${String(filters.search).trim()}%`);
  }

  if (filters.status) {
    query = query.eq("status", normalizeStatus(filters.status));
  }

  const suppliers = throwIfSupabaseError(await query, "listar fornecedores");
  const hydrated = await Promise.all(suppliers.map((item) => loadSupplierGraph(item)));

  return hydrated.map(serializeSupplier);
}

export async function getById(scope, id) {
  const supplier = await findSupplier(scope, id);

  if (!supplier) {
    throw new Error("Fornecedor nao encontrado");
  }

  return serializeSupplier(supplier);
}

export async function create(scope, data) {
  const { companyId, categoryId } = await resolveSupplierCompanyAndCategory(scope, data);
  const normalizedCnpj = normalizeCNPJ(data.cnpj);
  if (!normalizedCnpj) {
    throw new Error("CNPJ obrigatorio");
  }

  const supplier = await repo.insertRow("Supplier", {
    name: String(data.name || "").trim(),
    tradeName: String(data.tradeName || "").trim() || null,
    cnpj: normalizedCnpj,
    contact: String(data.contact || "").trim() || null,
    email: String(data.email || "").trim() || null,
    phone: String(data.phone || "").trim() || null,
    addressLine: String(data.addressLine || "").trim() || null,
    addressNumber: String(data.addressNumber || "").trim() || null,
    addressComplement: String(data.addressComplement || "").trim() || null,
    district: String(data.district || "").trim() || null,
    city: String(data.city || "").trim() || null,
    state: String(data.state || "").trim() || null,
    postalCode: String(data.postalCode || "").trim() || null,
    primaryActivity: String(data.primaryActivity || "").trim() || null,
    registrationStatus: String(data.registrationStatus || "").trim() || null,
    status: normalizeStatus(data.status),
    supplierType: normalizeSupplierType(data.supplierType),
    score: Number(data.score || 0),
    riskIndex: Number(data.riskIndex || 0),
    trend: String(data.trend || "ESTAVEL").trim().toUpperCase(),
    reactivationJustification: String(data.reactivationJustification || "").trim() || null,
    companyId,
    categoryId,
    lastEvaluationDate: data.lastEvaluationDate ? new Date(data.lastEvaluationDate) : null,
    nextReview: data.nextReview ? new Date(data.nextReview) : null
  });

  return getById(scope, supplier.id);
}

export async function update(scope, id, data) {
  const existing = await findSupplier(scope, id);

  if (!existing) {
    throw new Error("Fornecedor nao encontrado");
  }

  const { companyId, categoryId } = await resolveSupplierCompanyAndCategory(
    scope,
    data,
    existing.categoryId,
    existing.companyId
  );

  await repo.updateRow("Supplier", id, {
    name: String(data.name || existing.name).trim(),
    tradeName: String(data.tradeName || "").trim() || null,
    cnpj: normalizeCNPJ(data.cnpj || existing.cnpj),
    contact: String(data.contact || "").trim() || null,
    email: String(data.email || "").trim() || null,
    phone: String(data.phone || "").trim() || null,
    addressLine: String(data.addressLine || "").trim() || null,
    addressNumber: String(data.addressNumber || "").trim() || null,
    addressComplement: String(data.addressComplement || "").trim() || null,
    district: String(data.district || "").trim() || null,
    city: String(data.city || "").trim() || null,
    state: String(data.state || "").trim() || null,
    postalCode: String(data.postalCode || "").trim() || null,
    primaryActivity: String(data.primaryActivity || "").trim() || null,
    registrationStatus: String(data.registrationStatus || "").trim() || null,
    status: data.status ? normalizeStatus(data.status) : existing.status,
    supplierType: data.supplierType ? normalizeSupplierType(data.supplierType) : existing.supplierType,
    companyId,
    categoryId,
    reactivationJustification: String(data.reactivationJustification || "").trim() || null,
    lastEvaluationDate: data.lastEvaluationDate ? new Date(data.lastEvaluationDate) : existing.lastEvaluationDate,
    nextReview: data.nextReview ? new Date(data.nextReview) : existing.nextReview
  });

  return getById(scope, id);
}

export async function remove(scope, id) {
  const supplier = await findSupplier(scope, id);

  if (!supplier) {
    throw new Error("Fornecedor nao encontrado");
  }

  return repo.deleteRow("Supplier", id);
}

export async function fetchCNPJ(cnpj) {
  const normalized = normalizeCNPJ(cnpj);
  const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${normalized}`, {
    proxy: false
  });
  const data = response.data;

  return {
    cnpj: data.cnpj,
    name: data.razao_social,
    trade_name: data.nome_fantasia,
    contact: data.qsa?.[0]?.nome_socio || "",
    email: data.email || "",
    phone: data.ddd_telefone_1 || "",
    address_line: data.logradouro || "",
    address_number: data.numero || "",
    address_complement: data.complemento || "",
    district: data.bairro || "",
    city: data.municipio || "",
    state: data.uf || "",
    postal_code: data.cep || "",
    primary_activity: data.cnae_fiscal_descricao || "",
    registration_status: data.descricao_situacao_cadastral || ""
  };
}

export async function syncDocuments(scope, supplierId, documents = [], files = []) {
  const supplier = await findSupplier(scope, supplierId);

  if (!supplier) {
    throw new Error("Fornecedor nao encontrado");
  }

  const existingDocsByRequirement = new Map(
    (supplier.documents || [])
      .filter((item) => item.requiredDocumentId)
      .map((item) => [item.requiredDocumentId, item])
  );

  const filesByFieldName = new Map((files || []).map((file) => [file.fieldname, file]));
  const normalizedDocuments = Array.isArray(documents) ? documents : [];

  for (const item of normalizedDocuments) {
    const requiredDocumentId = Number(item.requiredDocumentId || 0);
    if (!requiredDocumentId) continue;

    const file = filesByFieldName.get(`document_${requiredDocumentId}`);
    const existing = existingDocsByRequirement.get(requiredDocumentId);
    const payload = {
      documentName: String(item.name || item.documentName || "").trim() || null,
      expiresAt: parseNullableDate(item.expiresAt)
    };

    if (file) {
      payload.filename = (await uploadSupplierDocumentToStorage(supplier.id, file)) || file.filename;
      payload.originalName = file.originalname;
    }

    if (existing) {
      await repo.updateRow("SupplierDocument", existing.id, payload);
      continue;
    }

    await repo.insertRow("SupplierDocument", {
      supplierId: supplier.id,
      requiredDocumentId,
      ...payload
    });
  }

  return getById(scope, supplier.id);
}

export async function getDocumentFile(scope, supplierId, documentId) {
  const supplier = await findSupplier(scope, supplierId);

  if (!supplier) {
    throw new Error("Fornecedor nao encontrado");
  }

  const document = (supplier.documents || []).find((item) => Number(item.id) === Number(documentId));

  if (!document || !document.filename) {
    throw new Error("Documento nao encontrado");
  }

  const localPath = path.join(supplierUploadsRoot, document.filename);

  if (fs.existsSync(localPath)) {
    return {
      path: localPath,
      filename: document.filename,
      originalName: document.originalName
    };
  }

  const buffer = await downloadSupplierDocumentFromStorage(supplier.id, document.filename);

  if (buffer) {
    return {
      buffer,
      filename: document.filename,
      originalName: document.originalName
    };
  }

  throw new Error("Arquivo do documento nao encontrado no armazenamento.");
}

export async function getEvaluationFile(scope, supplierId, evaluationId) {
  const supplier = await findSupplier(scope, supplierId);

  if (!supplier) {
    throw new Error("Fornecedor nao encontrado");
  }

  const evaluation = (supplier.evaluations || []).find((item) => Number(item.id) === Number(evaluationId));

  if (!evaluation || !evaluation.attachmentFilename) {
    throw new Error("Documento da avaliacao nao encontrado");
  }

  return {
    path: path.join(evaluationUploadsRoot, evaluation.attachmentFilename),
    filename: evaluation.attachmentFilename,
    originalName: evaluation.attachmentOriginalName
  };
}

export async function createEvaluation(scope, supplierId, evaluatorId, payload = {}, attachment = null) {
  const supplier = await findSupplier(scope, supplierId);

  if (!supplier) {
    throw new Error("Fornecedor nao encontrado");
  }

  const answers = normalizeEvaluationAnswers(payload.answers || [], supplier);
  if (!answers.length) {
    throw new Error("Informe ao menos uma resposta para a avaliacao");
  }

  const score = Number(average(answers.map((item) => item.score)).toFixed(2));
  const evaluationDate = payload.evaluationDate ? new Date(payload.evaluationDate) : new Date();
  const nextReview = nextReviewFromType(payload.supplierType || supplier.supplierType, evaluationDate);
  const defaultRncDeadline = new Date(evaluationDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const shouldBlock = score < 60;
  let evaluationId = null;

  const evaluation = await repo.insertRow("Evaluation", {
    supplierId: supplier.id,
    evaluatorId,
    evaluationDate,
    invoiceNumber: String(payload.invoiceNumber || "").trim() || null,
    observations: String(payload.observations || "").trim() || null,
    answers: JSON.stringify(answers),
    attachmentFilename: attachment?.filename || null,
    attachmentOriginalName: attachment?.originalname || null,
    score,
    classification: classifyScore(score)
  });
  evaluationId = evaluation.id;

  for (const answer of answers) {
    await repo.insertRow(
      "EvaluationAnswer",
      {
        evaluationId: evaluation.id,
        categoryQuestionId: answer.questionId,
        questionText: answer.questionText,
        score: answer.score,
        sortOrder: answer.sortOrder
      },
      { single: false }
    );
  }

  const previousEvaluations = await repo.findMany(
    "Evaluation",
    { supplierId: supplier.id },
    {
      orderBy: { evaluationDate: false, id: false },
      limit: 6
    }
  );

  const trend = trendFromEvaluations(previousEvaluations);

  await repo.updateRow("Supplier", supplier.id, {
    score,
    status: shouldBlock ? "BLOQUEADO" : supplier.status,
    trend,
    lastEvaluationDate: evaluationDate,
    nextReview
  });

  if (shouldBlock) {
    await repo.insertRow("RNC", {
      supplierId: supplier.id,
      evaluationId: evaluation.id,
      status: "ABERTA",
      description: "Fornecedor abaixo da nota minima",
      deadline: defaultRncDeadline
    });
  }

  if (shouldBlock && evaluationId) {
    await repo.updateRow("Supplier", supplier.id, { status: "BLOQUEADO" });

    const linkedRnc = await repo.findOne("RNC", {
      supplierId: supplier.id,
      evaluationId
    });

    if (!linkedRnc) {
      await repo.insertRow("RNC", {
        supplierId: supplier.id,
        evaluationId,
        status: "ABERTA",
        description: "Fornecedor abaixo da nota minima",
        deadline: defaultRncDeadline
      });
    }
  }

  const refreshed = await findSupplier(scope, supplier.id);
  const riskIndex = riskIndexForSupplier(refreshed);

  await repo.updateRow("Supplier", supplier.id, { riskIndex });

  return getById(scope, supplier.id);
}

export async function exportSuppliers(scope, res) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Fornecedores");

  sheet.columns = [
    { header: "Nome", key: "name", width: 32 },
    { header: "CNPJ", key: "cnpj", width: 20 },
    { header: "Categoria", key: "category", width: 24 },
    { header: "Tipo", key: "supplierType", width: 20 },
    { header: "Status", key: "status", width: 18 },
    { header: "Nota", key: "score", width: 12 },
    { header: "Risco", key: "riskIndex", width: 12 },
    { header: "Cidade", key: "city", width: 20 },
    { header: "Proxima revisao", key: "nextReview", width: 18 }
  ];

  const client = getSupabaseAdmin();
  let query = client.from("Supplier").select("*").order("name", { ascending: true });
  query = applyCompanyScope(query, scope);
  const data = throwIfSupabaseError(await query, "exportar fornecedores");

  const categoryIds = [...new Set(data.map((item) => item.categoryId).filter(Boolean))];
  let categoryMap = new Map();

  if (categoryIds.length) {
    const categories = throwIfSupabaseError(
      await client.from("Category").select("id,name").in("id", categoryIds),
      "listar categorias da exportacao"
    );
    categoryMap = new Map(categories.map((item) => [item.id, item]));
  }

  sheet.addRows(
    data.map((item) => ({
      name: item.name,
      cnpj: item.cnpj,
      category: categoryMap.get(item.categoryId)?.name || "-",
      supplierType: item.supplierType,
      status: item.status,
      score: item.score,
      riskIndex: item.riskIndex,
      city: item.city || "-",
      nextReview: item.nextReview ? new Date(item.nextReview).toLocaleDateString("pt-BR") : "-"
    }))
  );

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="fornecedores.xlsx"');

  await workbook.xlsx.write(res);
  res.end();
}
