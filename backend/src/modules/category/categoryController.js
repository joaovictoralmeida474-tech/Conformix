import * as categoryService from "./categoryService.js";
import { log } from "../audit/auditService.js";

export async function listCategories(req, res) {
  const items = await categoryService.list(req.user.companyId);
  res.json(items);
}

export async function createCategory(req, res) {
  try {
    const item = await categoryService.create(req.user.companyId, req.body);
    await log(req.user.id, "create", {
      entity: "categoria",
      entityId: item.id,
      details: `Criou categoria ${item.name}`
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function updateCategory(req, res) {
  try {
    const item = await categoryService.update(req.user.companyId, req.params.id, req.body);
    await log(req.user.id, "update", {
      entity: "categoria",
      entityId: item.id,
      details: `Atualizou categoria ${item.name}`
    });
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function deleteCategory(req, res) {
  try {
    await categoryService.remove(req.user.companyId, req.params.id);
    await log(req.user.id, "delete", {
      entity: "categoria",
      entityId: req.params.id,
      details: `Excluiu categoria ${req.params.id}`
    });
    res.sendStatus(204);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
