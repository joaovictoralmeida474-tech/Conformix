import { prisma } from "../../shared/database/prisma.js";
import { buildSupplierCompanyWhere } from "../../shared/auth/dataScope.js";

export async function log(userId, action, meta = {}) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity: meta.entity || "sistema",
      entityId: meta.entityId ? Number(meta.entityId) : null,
      details: meta.details || null
    }
  });
}

export async function listByCompany(scope) {
  return prisma.auditLog.findMany({
    where: {
      user: buildSupplierCompanyWhere(scope).supplier
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}
