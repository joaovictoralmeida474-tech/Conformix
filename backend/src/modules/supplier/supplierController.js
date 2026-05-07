import * as supplierService from "./supplierService.js";
import { log } from "../audit/auditService.js";

export async function listSuppliers(req, res) {
  const data = await supplierService.list(req.user.companyId, req.query);
  res.json(data);
}

export async function createSupplier(req, res) {
  try {
    const supplier = await supplierService.create(req.user.companyId, req.body);
    await log(req.user.id, "create", {
      entity: "fornecedor",
      entityId: supplier.id,
      details: `Criou fornecedor ${supplier.name}`
    });
    res.status(201).json(supplier);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function getSupplier(req, res) {
  try {
    const supplier = await supplierService.getById(req.user.companyId, req.params.id);
    res.json(supplier);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}

export async function updateSupplier(req, res) {
  try {
    const supplier = await supplierService.update(req.user.companyId, req.params.id, req.body);
    await log(req.user.id, "update", {
      entity: "fornecedor",
      entityId: supplier.id,
      details: `Atualizou fornecedor ${supplier.name}`
    });
    res.json(supplier);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function deleteSupplier(req, res) {
  try {
    await supplierService.remove(req.user.companyId, req.params.id);
    await log(req.user.id, "delete", {
      entity: "fornecedor",
      entityId: req.params.id,
      details: `Excluiu fornecedor ${req.params.id}`
    });
    res.sendStatus(204);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function buscarCNPJ(req, res) {
  try {
    const data = await supplierService.fetchCNPJ(req.params.cnpj);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: "Nao foi possivel consultar o CNPJ" });
  }
}

export async function evaluateSupplier(req, res) {
  try {
    const rawAnswers = req.body.answers;
    const payload = {
      ...req.body,
      answers: typeof rawAnswers === "string" ? JSON.parse(rawAnswers) : rawAnswers
    };

    const evaluation = await supplierService.createEvaluation(
      req.user.companyId,
      req.params.id,
      req.user.id,
      payload,
      req.file || null
    );

    await log(req.user.id, "create", {
      entity: "avaliacao",
      entityId: req.params.id,
      details: `Avaliou fornecedor ${req.params.id}`
    });
    res.status(201).json(evaluation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function downloadEvaluationDocument(req, res) {
  try {
    const file = await supplierService.getEvaluationFile(
      req.user.companyId,
      req.params.id,
      req.params.evaluationId
    );

    res.download(file.path, file.originalName || file.filename);
  } catch (error) {
    res.status(404).json({ error: error.message || "Documento da avaliacao nao encontrado." });
  }
}

export async function exportSupplierExcel(req, res) {
  await supplierService.exportSuppliers(req.user.companyId, res);
}

export async function downloadSupplierDocument(req, res) {
  try {
    const file = await supplierService.getDocumentFile(
      req.user.companyId,
      req.params.id,
      req.params.documentId
    );

    res.download(file.path, file.originalName || file.filename);
  } catch (error) {
    res.status(404).json({ error: error.message || "Documento nao encontrado." });
  }
}

export async function syncSupplierDocuments(req, res) {
  try {
    const rawDocuments = req.body.documents;
    const documents =
      typeof rawDocuments === "string" ? JSON.parse(rawDocuments) : rawDocuments || [];

    const supplier = await supplierService.syncDocuments(
      req.user.companyId,
      req.params.id,
      documents,
      req.files || []
    );

    await log(req.user.id, "update", {
      entity: "fornecedor_documentos",
      entityId: Number(req.params.id),
      details: `Atualizou documentos do fornecedor ${req.params.id}`
    });

    res.json(supplier);
  } catch (error) {
    res.status(400).json({ error: error.message || "Nao foi possivel atualizar os documentos." });
  }
}
