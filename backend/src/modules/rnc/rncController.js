import * as rncService from "./rncService.js";
import { log } from "../audit/auditService.js";

export async function listRNC(req, res) {
  const items = await rncService.list(req.user);
  res.json(items);
}

export async function updateRNC(req, res) {
  try {
    const updated = await rncService.update(req.user, req.params.id, req.body);
    log(req.user.id, "update", {
      entity: "rnc",
      entityId: updated.id,
      details: `Atualizou RNC ${updated.id}`
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
