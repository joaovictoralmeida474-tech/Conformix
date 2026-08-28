import * as nfsService from "./nfsService.js";
import { log } from "../audit/auditService.js";

export async function listInvoices(req, res) {
  try {
    const items = await nfsService.list(req.user, {
      supplierId: req.query.supplierId,
      status: req.query.status
    });
    res.json(items);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function getInvoice(req, res) {
  try {
    const item = await nfsService.getById(req.user, req.params.id);
    res.json(item);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}

export async function createInvoice(req, res) {
  try {
    const created = await nfsService.create(req.user, req.body, req.user.id);
    log(req.user.id, "create", {
      entity: "service_invoice",
      entityId: created.id,
      details: `Cadastrou NF ${created.number}`
    });
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function updateInvoice(req, res) {
  try {
    const updated = await nfsService.update(req.user, req.params.id, req.body, req.user.id);
    log(req.user.id, "update", {
      entity: "service_invoice",
      entityId: updated.id,
      details: `Atualizou NF ${updated.number}`
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function updateInvoiceStatus(req, res) {
  try {
    const updated = await nfsService.updateStatus(
      req.user,
      req.params.id,
      req.body?.status,
      req.user.id
    );
    log(req.user.id, "update", {
      entity: "service_invoice",
      entityId: updated.id,
      details: `Alterou status da NF ${updated.number} para ${updated.status}`
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function uploadInvoiceFiles(req, res) {
  try {
    const files = {
      pdfFile: req.files?.pdfFile?.[0] || req.files?.pdf?.[0] || null,
      xmlFile: req.files?.xmlFile?.[0] || req.files?.xml?.[0] || null
    };

    if (!files.pdfFile && !files.xmlFile) {
      return res.status(400).json({ error: "Envie um arquivo PDF e/ou XML" });
    }

    const updated = await nfsService.attachFiles(req.user, req.params.id, files, req.user.id);
    log(req.user.id, "update", {
      entity: "service_invoice",
      entityId: updated.id,
      details: `Anexou documentos na NF ${updated.number}`
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function deleteInvoiceFile(req, res) {
  try {
    const updated = await nfsService.removeFile(
      req.user,
      req.params.id,
      req.params.kind,
      req.user.id
    );
    log(req.user.id, "update", {
      entity: "service_invoice",
      entityId: updated.id,
      details: `Removeu anexo ${req.params.kind} da NF ${updated.number}`
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function downloadInvoiceFile(req, res) {
  try {
    const file = await nfsService.downloadFile(req.user, req.params.id, req.params.kind);

    if (file.mode === "file") {
      return res.download(file.path, file.originalName);
    }

    res.setHeader("Content-Type", file.contentType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file.originalName || "arquivo")}"`
    );
    return res.send(file.buffer);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}

export async function deleteInvoice(req, res) {
  try {
    await nfsService.remove(req.user, req.params.id);
    log(req.user.id, "delete", {
      entity: "service_invoice",
      entityId: Number(req.params.id),
      details: `Excluiu nota fiscal ${req.params.id}`
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
