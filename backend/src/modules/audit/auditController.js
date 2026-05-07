import { listByCompany } from "./auditService.js";

export async function listAuditLogs(req, res) {
  const items = await listByCompany(req.user.companyId);
  res.json(items);
}
