import { prisma } from "../../shared/database/prisma.js";

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

export async function listByCompany(companyId) {
  return prisma.auditLog.findMany({
    where: {
      user: {
        companyId
      }
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
