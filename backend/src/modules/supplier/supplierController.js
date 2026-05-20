import * as supplierService from "./supplierService.js";
import { log } from "../audit/auditService.js";

function isDatabaseUnavailableError(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");

  return (
    code.startsWith("P") ||
    /prisma/i.test(error?.name || "") ||
    /Supabase nao configurado/i.test(message) ||
    /can't reach database server/i.test(message)
  );
}

export async function listSuppliers(req, res) {
  try {
    const data = await supplierService.list(req.user, req.query);
    res.json(data);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.json([]);
    }

    res.status(500).json({ error: error.message || "Erro ao listar fornecedores" });
  }
}

export async function createSupplier(req, res) {
  try {
    const supplier = await supplierService.create(req.user, req.body);
    log(req.user.id, "create", {
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
    const supplier = await supplierService.getById(req.user, req.params.id);
    res.json(supplier);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}

export async function updateSupplier(req, res) {
  try {
    const supplier = await supplierService.update(req.user, req.params.id, req.body);
    log(req.user.id, "update", {
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
    await supplierService.remove(req.user, req.params.id);
    log(req.user.id, "delete", {
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
      req.user,
      req.params.id,
      req.user.id,
      payload,
      req.file || null
    );

    log(req.user.id, "create", {
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
      req.user,
      req.params.id,
      req.params.evaluationId
    );

    res.download(file.path, file.originalName || file.filename);
  } catch (error) {
    res.status(404).json({ error: error.message || "Documento da avaliacao nao encontrado." });
  }
}

export async function exportSupplierExcel(req, res) {
  await supplierService.exportSuppliers(req.user, res);
}

export async function downloadSupplierDocument(req, res) {
  try {
    const file = await supplierService.getDocumentFile(
      req.user,
      req.params.id,
      req.params.documentId
    );

    if (file.buffer) {
      const downloadName = file.originalName || file.filename || "documento.pdf";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
      );
      return res.send(file.buffer);
    }

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
      req.user,
      req.params.id,
      documents,
      req.files || []
    );

    log(req.user.id, "update", {
      entity: "fornecedor_documentos",
      entityId: Number(req.params.id),
      details: `Atualizou documentos do fornecedor ${req.params.id}`
    });

    res.json(supplier);
  } catch (error) {
    res.status(400).json({ error: error.message || "Nao foi possivel atualizar os documentos." });
  }
}
