import { prisma } from "../../shared/database/prisma.js";

function isOverdue(value) {
  return value ? new Date(value).getTime() < Date.now() : false;
}

function buildAlerts(suppliers, rncs) {
  const alerts = [];

  for (const supplier of suppliers) {
    if (supplier.status === "BLOQUEADO") {
      alerts.push({
        type: "fornecedor_bloqueado",
        supplierId: supplier.id,
        message: `O fornecedor ${supplier.name} foi bloqueado e precisa de tratativa.`
      });
    }

    if (supplier.nextReview && isOverdue(supplier.nextReview)) {
      alerts.push({
        type: "avaliacao_vencida",
        supplierId: supplier.id,
        message: `A avaliacao do fornecedor ${supplier.name} esta vencida.`
      });
    }

    const expiringDocuments = (supplier.documents || []).filter((item) => {
      if (!item.expiresAt) return false;
      const diff = new Date(item.expiresAt).getTime() - Date.now();
      return diff >= 0 && diff <= 15 * 24 * 60 * 60 * 1000;
    });

    if (expiringDocuments.length) {
      alerts.push({
        type: "documento_vencendo",
        supplierId: supplier.id,
        message: `${expiringDocuments.length} documento(s) do fornecedor ${supplier.name} vencem em breve.`
      });
    }
  }

  for (const item of rncs) {
    if (item.deadline && isOverdue(item.deadline) && item.status === "ABERTA") {
      alerts.push({
        type: "rnc_vencida",
        supplierId: item.supplierId,
        message: `A RNC ${item.id} do fornecedor ${item.supplier?.name || item.supplierId} esta com prazo vencido.`
      });
    }
  }

  return alerts;
}

export async function getMetrics(companyId) {
  const [suppliers, openRncs] = await Promise.all([
    prisma.supplier.findMany({
      where: { companyId },
      include: {
        documents: true,
        evaluations: {
          orderBy: [{ evaluationDate: "desc" }, { id: "desc" }],
          take: 1
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.rNC.findMany({
      where: {
        supplier: {
          companyId
        }
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const total = suppliers.length;
  const bloqueados = suppliers.filter((item) => item.status === "BLOQUEADO").length;
  const rnc = openRncs.filter((item) => item.status === "ABERTA").length;
  const expiring = suppliers.filter((item) => {
    if (!item.nextReview) return false;
    const diff = new Date(item.nextReview).getTime() - Date.now();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const scores = suppliers
    .map((item) => Number(item.score || 0))
    .filter((value) => !Number.isNaN(value));
  const averageScore = scores.length
    ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2))
    : 0;

  const ranking = [...suppliers]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: item.name,
      score: item.score,
      riskIndex: item.riskIndex,
      status: item.status
    }));

  const alerts = buildAlerts(suppliers, openRncs).slice(0, 10);
  const openRncItems = openRncs
    .filter((item) => item.status === "ABERTA")
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      deadline: item.deadline,
      status: item.status,
      supplierId: item.supplierId,
      supplier: item.supplier
    }));

  return {
    total,
    bloqueados,
    rnc,
    expiring,
    averageScore,
    ranking,
    alerts,
    openRncs: openRncItems,
    overdueRncs: openRncs.filter((item) => item.deadline && isOverdue(item.deadline) && item.status === "ABERTA"),
    labels: suppliers.map((item) => item.name),
    scores: suppliers.map((item) => Number(item.score || 0)),
    risks: suppliers.map((item) => Number(item.riskIndex || 0))
  };
}
