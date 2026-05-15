import * as categoryService from "./categoryService.js";
import { log } from "../audit/auditService.js";

function isDatabaseUnavailableError(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");

  return (
    code.startsWith("P") ||
    /prisma/i.test(error?.name || "") ||
    /DATABASE_URL nao configurada/i.test(message) ||
    /can't reach database server/i.test(message)
  );
}

export async function listCategories(req, res) {
  try {
    const items = await categoryService.list(req.user);
    res.json(items);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.json([]);
    }

    res.status(500).json({ error: error.message || "Erro ao listar categorias" });
  }
}

export async function createCategory(req, res) {
  try {
    const item = await categoryService.create(req.user, req.body);
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
    const item = await categoryService.update(req.user, req.params.id, req.body);
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
    await categoryService.remove(req.user, req.params.id);
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
