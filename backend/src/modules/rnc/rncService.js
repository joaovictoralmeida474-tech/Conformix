import { prisma } from "../../shared/database/prisma.js";

function addThirtyDays(baseDate) {
  const deadline = new Date(baseDate);
  deadline.setDate(deadline.getDate() + 30);
  return deadline;
}

export async function list(companyId) {
  const items = await prisma.rNC.findMany({
    where: {
      supplier: {
        companyId
      }
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          status: true,
          supplierType: true,
          riskIndex: true
        }
      },
      evaluation: {
        select: {
          id: true,
          score: true,
          classification: true,
          evaluationDate: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  const missingDeadline = items.filter(
    (item) => !item.deadline && item.evaluation?.evaluationDate
  );

  if (missingDeadline.length) {
    await prisma.$transaction(
      missingDeadline.map((item) =>
        prisma.rNC.update({
          where: { id: item.id },
          data: {
            deadline: addThirtyDays(item.evaluation.evaluationDate)
          }
        })
      )
    );

    return items.map((item) =>
      !item.deadline && item.evaluation?.evaluationDate
        ? { ...item, deadline: addThirtyDays(item.evaluation.evaluationDate) }
        : item
    );
  }

  return items;
}

export async function update(companyId, id, data) {
  const existing = await prisma.rNC.findFirst({
    where: {
      id: Number(id),
      supplier: {
        companyId
      }
    }
  });

  if (!existing) {
    throw new Error("RNC nao encontrada");
  }

  await prisma.$transaction(async (tx) => {
    await tx.rNC.update({
      where: { id: Number(id) },
      data: {
        status: data.status || existing.status,
        actionPlan: data.actionPlan ?? existing.actionPlan,
        description: data.description ?? existing.description,
        cause: data.cause ?? existing.cause,
        correctiveAction: data.correctiveAction ?? existing.correctiveAction,
        responsible: data.responsible ?? existing.responsible,
        deadline: data.deadline ? new Date(data.deadline) : existing.deadline,
        treatedAt: data.treatedAt ? new Date(data.treatedAt) : existing.treatedAt
      }
    });

    if (data.supplierStatusAction) {
      await tx.supplier.update({
        where: { id: existing.supplierId },
        data: {
          status:
            String(data.supplierStatusAction).toUpperCase() === "ATIVO" ||
            String(data.supplierStatusAction).toUpperCase() === "ACTIVE"
              ? "ATIVO"
              : "BLOQUEADO"
        }
      });
    }
  });

  return prisma.rNC.findUnique({
    where: { id: Number(id) },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          status: true,
          supplierType: true,
          riskIndex: true
        }
      },
      evaluation: {
        select: {
          id: true,
          score: true,
          classification: true,
          evaluationDate: true
        }
      }
    }
  });
}
