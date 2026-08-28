import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

import { invalidateDashboardMetricsCache } from "../dashboard/dashboardService.js";
import {
  isSuperAdminScope,
  resolveTargetCompanyId
} from "../../shared/auth/dataScope.js";
import { applyCompanyScope, getSupplierIdsForScope } from "../../shared/database/supabaseScope.js";
import { getSupabaseAdmin, throwIfSupabaseError } from "../../shared/database/supabaseStore.js";
import { getInvoiceUploadsRoot } from "../../shared/uploads.js";

const INVOICE_DOCUMENTS_BUCKET = "supplier-documents";
const INVOICE_COLUMNS =
  "id,number,series,supplierId,companyId,serviceDescription,contractReference,observations,issueDate,competenceDate,grossAmount,discountAmount,netAmount,issAmount,inssAmount,irAmount,pisAmount,cofinsAmount,csllAmount,status,pdfFilename,pdfOriginalName,xmlFilename,xmlOriginalName,createdById,updatedById,createdAt,updatedAt";

const ALLOWED_STATUSES = new Set(["EM_ANALISE", "APROVADA", "COM_PENDENCIA", "CANCELADA"]);
const invoiceUploadsRoot = getInvoiceUploadsRoot();

function parseNullableDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseAmount(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalAmount(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (ALLOWED_STATUSES.has(normalized)) {
    return normalized;
  }

  return "EM_ANALISE";
}

function computeNetAmount(grossAmount, discountAmount, explicitNet) {
  if (explicitNet !== undefined && explicitNet !== null && explicitNet !== "") {
    return parseAmount(explicitNet, 0);
  }

  return Math.max(0, parseAmount(grossAmount, 0) - parseAmount(discountAmount, 0));
}

async function ensureInvoiceDocumentsBucket(client) {
  const existing = await client.storage.getBucket(INVOICE_DOCUMENTS_BUCKET);

  if (!existing.error) {
    return true;
  }

  const created = await client.storage.createBucket(INVOICE_DOCUMENTS_BUCKET, {
    public: false
  });

  return !created.error;
}

async function uploadInvoiceFileToStorage(invoiceId, file) {
  if (!file?.path || !file?.filename) {
    return null;
  }

  try {
    const client = getSupabaseAdmin();
    const hasBucket = await ensureInvoiceDocumentsBucket(client);

    if (!hasBucket) {
      return null;
    }

    const storagePath = `invoices/${Number(invoiceId)}/${file.filename}`;
    const buffer = await fsPromises.readFile(file.path);
    const result = await client.storage.from(INVOICE_DOCUMENTS_BUCKET).upload(storagePath, buffer, {
      contentType: file.mimetype || "application/octet-stream",
      upsert: true
    });

    if (result.error) {
      console.error("Falha ao enviar anexo da NF para o Storage:", result.error.message);
      return null;
    }

    return storagePath;
  } catch (error) {
    console.error("Falha ao preparar upload da NF:", error?.message || error);
    return null;
  }
}

async function downloadInvoiceFileFromStorage(invoiceId, filename) {
  const client = getSupabaseAdmin();
  const candidates = [
    String(filename || "").trim(),
    `invoices/${Number(invoiceId)}/${String(filename || "").trim()}`
  ].filter(Boolean);

  for (const candidate of [...new Set(candidates)]) {
    const result = await client.storage.from(INVOICE_DOCUMENTS_BUCKET).download(candidate);

    if (result.error || !result.data) {
      continue;
    }

    const arrayBuffer = await result.data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  return null;
}

async function removeLocalFile(filename) {
  if (!filename) return;

  const localPath = path.join(invoiceUploadsRoot, path.basename(String(filename)));

  try {
    await fsPromises.unlink(localPath);
  } catch {
    // Arquivo local pode nao existir (ex.: somente Storage).
  }
}

async function assertSupplierInScope(scope, supplierId) {
  const client = getSupabaseAdmin();
  let query = client
    .from("Supplier")
    .select("id,name,cnpj,companyId,status")
    .eq("id", Number(supplierId))
    .maybeSingle();

  query = applyCompanyScope(query, scope);

  const supplier = throwIfSupabaseError(await query, "validar fornecedor da nota fiscal");

  if (!supplier) {
    throw new Error("Fornecedor nao encontrado ou fora do escopo");
  }

  return supplier;
}

function normalizeCnpjDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

async function findSupplierByCnpjInScope(scope, cnpj) {
  const normalized = normalizeCnpjDigits(cnpj);

  if (!normalized || normalized.length < 14) {
    return null;
  }

  const client = getSupabaseAdmin();
  let query = client
    .from("Supplier")
    .select("id,name,cnpj,companyId,status")
    .eq("cnpj", normalized)
    .maybeSingle();

  query = applyCompanyScope(query, scope);

  return throwIfSupabaseError(await query, "buscar fornecedor por CNPJ da nota fiscal");
}

async function resolveInvoiceSupplier(scope, body = {}) {
  const supplierId = Number(body.supplierId);
  const bodyCnpj = normalizeCnpjDigits(body.supplierCnpj || body.cnpj);

  if (Number.isInteger(supplierId) && supplierId > 0) {
    const supplier = await assertSupplierInScope(scope, supplierId);

    if (bodyCnpj && normalizeCnpjDigits(supplier.cnpj) && bodyCnpj !== normalizeCnpjDigits(supplier.cnpj)) {
      throw new Error("O CNPJ informado nao corresponde ao prestador selecionado");
    }

    return supplier;
  }

  if (bodyCnpj) {
    const supplier = await findSupplierByCnpjInScope(scope, bodyCnpj);

    if (supplier) {
      return supplier;
    }

    throw new Error("Nenhum fornecedor cadastrado com este CNPJ. Cadastre o prestador antes de lancar a NF.");
  }

  throw new Error("Prestador obrigatorio. Selecione o fornecedor cadastrado no SaaS.");
}

async function listInvoiceRowsForScope(scope, filters = {}) {
  const client = getSupabaseAdmin();
  let query = client.from("ServiceInvoice").select(INVOICE_COLUMNS).order("issueDate", {
    ascending: false
  });

  query = applyCompanyScope(query, scope);

  if (filters.supplierId) {
    query = query.eq("supplierId", Number(filters.supplierId));
  }

  if (filters.status) {
    query = query.eq("status", normalizeStatus(filters.status));
  }

  if (!isSuperAdminScope(scope) && !filters.supplierId) {
    const supplierIds = await getSupplierIdsForScope(scope);

    if (!supplierIds.length) {
      return [];
    }

    query = query.in("supplierId", supplierIds);
  }

  return throwIfSupabaseError(await query, "listar notas fiscais");
}

async function loadInvoiceGraphs(rows = []) {
  if (!rows.length) {
    return [];
  }

  const client = getSupabaseAdmin();
  const supplierIds = [...new Set(rows.map((item) => item.supplierId).filter(Boolean))];
  const suppliers = supplierIds.length
    ? throwIfSupabaseError(
        await client.from("Supplier").select("id,name,cnpj,status,companyId").in("id", supplierIds),
        "listar fornecedores das notas fiscais"
      )
    : [];

  const supplierMap = new Map(suppliers.map((item) => [item.id, item]));

  return rows.map((item) => ({
    ...item,
    supplier: supplierMap.get(item.supplierId) || null
  }));
}

async function findInvoiceInScope(scope, id) {
  const client = getSupabaseAdmin();
  let query = client
    .from("ServiceInvoice")
    .select(INVOICE_COLUMNS)
    .eq("id", Number(id))
    .maybeSingle();

  query = applyCompanyScope(query, scope);

  const row = throwIfSupabaseError(await query, "buscar nota fiscal");

  if (!row) {
    return null;
  }

  const [graph] = await loadInvoiceGraphs([row]);
  return graph || null;
}

function buildPayload(body = {}, options = {}) {
  const grossAmount = parseAmount(body.grossAmount, 0);
  const discountAmount = parseAmount(body.discountAmount, 0);
  const netAmount = computeNetAmount(grossAmount, discountAmount, body.netAmount);
  const issueDate = parseNullableDate(body.issueDate);

  if (!issueDate) {
    throw new Error("Data de emissao obrigatoria");
  }

  const payload = {
    number: String(body.number || "").trim(),
    series: String(body.series || "").trim() || null,
    serviceDescription: String(body.serviceDescription || "").trim() || null,
    contractReference: String(body.contractReference || "").trim() || null,
    observations: String(body.observations || "").trim() || null,
    issueDate,
    competenceDate: parseNullableDate(body.competenceDate),
    grossAmount,
    discountAmount,
    netAmount,
    issAmount: parseOptionalAmount(body.issAmount),
    inssAmount: parseOptionalAmount(body.inssAmount),
    irAmount: parseOptionalAmount(body.irAmount),
    pisAmount: parseOptionalAmount(body.pisAmount),
    cofinsAmount: parseOptionalAmount(body.cofinsAmount),
    csllAmount: parseOptionalAmount(body.csllAmount),
    status: normalizeStatus(body.status),
    updatedAt: new Date().toISOString()
  };

  if (!payload.number) {
    throw new Error("Numero da NF obrigatorio");
  }

  if (options.includeCreateFields) {
    payload.createdAt = new Date().toISOString();
  }

  return payload;
}

export async function list(scope, filters = {}) {
  const rows = await listInvoiceRowsForScope(scope, filters);
  return loadInvoiceGraphs(rows);
}

export async function getById(scope, id) {
  const invoice = await findInvoiceInScope(scope, id);

  if (!invoice) {
    throw new Error("Nota fiscal nao encontrada");
  }

  return invoice;
}

export async function create(scope, body = {}, userId = null) {
  const supplier = await resolveInvoiceSupplier(scope, body);
  const companyId = resolveTargetCompanyId(scope, supplier.companyId) || supplier.companyId;
  const payload = buildPayload(body, { includeCreateFields: true });

  payload.supplierId = supplier.id;
  payload.companyId = companyId;
  payload.createdById = userId ? Number(userId) : null;
  payload.updatedById = userId ? Number(userId) : null;

  const client = getSupabaseAdmin();
  const created = throwIfSupabaseError(
    await client.from("ServiceInvoice").insert(payload).select(INVOICE_COLUMNS).single(),
    "criar nota fiscal"
  );

  invalidateDashboardMetricsCache();
  const [graph] = await loadInvoiceGraphs([created]);
  return graph;
}

export async function update(scope, id, body = {}, userId = null) {
  const existing = await findInvoiceInScope(scope, id);

  if (!existing) {
    throw new Error("Nota fiscal nao encontrada");
  }

  const supplier = await resolveInvoiceSupplier(scope, {
    ...existing,
    ...body,
    supplierId: body.supplierId !== undefined && body.supplierId !== null && body.supplierId !== ""
      ? body.supplierId
      : existing.supplierId,
    supplierCnpj: body.supplierCnpj || body.cnpj
  });

  const payload = buildPayload(
    {
      ...existing,
      ...body,
      supplierId: supplier.id
    },
    { includeCreateFields: false }
  );

  payload.supplierId = supplier.id;
  payload.companyId = supplier.companyId;
  payload.updatedById = userId ? Number(userId) : null;
  payload.pdfFilename = existing.pdfFilename;
  payload.pdfOriginalName = existing.pdfOriginalName;
  payload.xmlFilename = existing.xmlFilename;
  payload.xmlOriginalName = existing.xmlOriginalName;

  const client = getSupabaseAdmin();
  const updated = throwIfSupabaseError(
    await client
      .from("ServiceInvoice")
      .update(payload)
      .eq("id", existing.id)
      .select(INVOICE_COLUMNS)
      .single(),
    "atualizar nota fiscal"
  );

  invalidateDashboardMetricsCache();
  const [graph] = await loadInvoiceGraphs([updated]);
  return graph;
}

export async function updateStatus(scope, id, status, userId = null) {
  return update(scope, id, { status }, userId);
}

export async function attachFiles(scope, id, files = {}, userId = null) {
  const existing = await findInvoiceInScope(scope, id);

  if (!existing) {
    throw new Error("Nota fiscal nao encontrada");
  }

  const client = getSupabaseAdmin();
  const patch = {
    updatedAt: new Date().toISOString(),
    updatedById: userId ? Number(userId) : null
  };

  if (files.pdfFile) {
    const storagePath =
      (await uploadInvoiceFileToStorage(existing.id, files.pdfFile)) || files.pdfFile.filename;
    patch.pdfFilename = storagePath;
    patch.pdfOriginalName = files.pdfFile.originalname || files.pdfFile.filename;
  }

  if (files.xmlFile) {
    const storagePath =
      (await uploadInvoiceFileToStorage(existing.id, files.xmlFile)) || files.xmlFile.filename;
    patch.xmlFilename = storagePath;
    patch.xmlOriginalName = files.xmlFile.originalname || files.xmlFile.filename;
  }

  const updated = throwIfSupabaseError(
    await client
      .from("ServiceInvoice")
      .update(patch)
      .eq("id", existing.id)
      .select(INVOICE_COLUMNS)
      .single(),
    "anexar arquivos da nota fiscal"
  );

  invalidateDashboardMetricsCache();
  const [graph] = await loadInvoiceGraphs([updated]);
  return graph;
}

export async function removeFile(scope, id, kind = "pdf", userId = null) {
  const existing = await findInvoiceInScope(scope, id);

  if (!existing) {
    throw new Error("Nota fiscal nao encontrada");
  }

  const normalizedKind = String(kind || "pdf").toLowerCase();
  const patch = {
    updatedAt: new Date().toISOString(),
    updatedById: userId ? Number(userId) : null
  };

  if (normalizedKind === "xml") {
    await removeLocalFile(existing.xmlFilename);
    patch.xmlFilename = null;
    patch.xmlOriginalName = null;
  } else {
    await removeLocalFile(existing.pdfFilename);
    patch.pdfFilename = null;
    patch.pdfOriginalName = null;
  }

  const client = getSupabaseAdmin();
  const updated = throwIfSupabaseError(
    await client
      .from("ServiceInvoice")
      .update(patch)
      .eq("id", existing.id)
      .select(INVOICE_COLUMNS)
      .single(),
    "remover anexo da nota fiscal"
  );

  const [graph] = await loadInvoiceGraphs([updated]);
  return graph;
}

export async function downloadFile(scope, id, kind = "pdf") {
  const existing = await findInvoiceInScope(scope, id);

  if (!existing) {
    throw new Error("Nota fiscal nao encontrada");
  }

  const normalizedKind = String(kind || "pdf").toLowerCase();
  const filename = normalizedKind === "xml" ? existing.xmlFilename : existing.pdfFilename;
  const originalName =
    normalizedKind === "xml" ? existing.xmlOriginalName : existing.pdfOriginalName;

  if (!filename) {
    throw new Error("Arquivo nao encontrado");
  }

  const basename = path.basename(String(filename));
  const localPath = path.join(invoiceUploadsRoot, basename);

  if (fs.existsSync(localPath)) {
    return {
      mode: "file",
      path: localPath,
      originalName: originalName || basename
    };
  }

  const buffer = await downloadInvoiceFileFromStorage(existing.id, filename);

  if (!buffer) {
    throw new Error("Arquivo nao encontrado no armazenamento");
  }

  return {
    mode: "buffer",
    buffer,
    originalName: originalName || basename,
    contentType:
      normalizedKind === "xml" ? "application/xml" : "application/pdf"
  };
}

export async function remove(scope, id) {
  const existing = await findInvoiceInScope(scope, id);

  if (!existing) {
    throw new Error("Nota fiscal nao encontrada");
  }

  await removeLocalFile(existing.pdfFilename);
  await removeLocalFile(existing.xmlFilename);

  const client = getSupabaseAdmin();
  throwIfSupabaseError(
    await client.from("ServiceInvoice").delete().eq("id", existing.id),
    "excluir nota fiscal"
  );

  invalidateDashboardMetricsCache();
  return { success: true };
}
