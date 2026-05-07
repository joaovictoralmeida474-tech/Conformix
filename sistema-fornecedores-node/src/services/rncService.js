const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list() {
  return await prisma.rNC.findMany({
    orderBy: {
      id: 'desc'
    },
    include: {
      supplier: true
    }
  });
}

async function update(id, data) {
  const rnc = await prisma.rNC.findUnique({
    where: { id: Number(id) },
    include: { supplier: true }
  });

  if (!rnc) {
    throw new Error('RNC nao encontrada');
  }

  const updated = await prisma.rNC.update({
    where: { id: rnc.id },
    data: {
      description: data.description,
      status: data.status,
      cause: data.cause || null,
      correctiveAction: data.correctiveAction || null,
      responsible: data.responsible || null,
      deadline: data.deadline ? new Date(data.deadline) : null,
      treatmentDate: data.treatmentDate ? new Date(data.treatmentDate) : null
    }
  });

  const supplierStatus = data.supplierStatusAction || data.supplierStatus;

  if (supplierStatus) {
    await prisma.supplier.update({
      where: { id: rnc.supplier.id },
      data: {
        status: supplierStatus
      }
    });
  }

  return updated;
}

module.exports = {
  list,
  update
};
