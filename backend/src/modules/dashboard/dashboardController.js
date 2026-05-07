import { getMetrics } from "./dashboardService.js";

export async function getDashboard(req, res) {
  const data = await getMetrics(req.user.companyId);
  res.json(data);
}
