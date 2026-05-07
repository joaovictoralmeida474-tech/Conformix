const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function calculateScore(scores) {
  if (!scores.length) return 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Number(avg.toFixed(2));
}

function classify(score) {
  if (score >= 90) return 'Excelente';
  if (score >= 70) return 'Aprovado';
  return 'Critico';
}

async function create(data) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: data.supplierId },
    include: {
      evaluations: true
    }
  });

  if (!supplier) {
    throw new Error('Fornecedor nao encontrado');
  }

  const scores = (data.answers || []).map((answer) => Number(answer.score) || 0);
  const finalScore = calculateScore(scores);

  const evaluationDate = data.evaluationDate ? new Date(data.evaluationDate) : new Date();

  const evaluation = await prisma.evaluation.create({
    data: {
      supplierId: supplier.id,
      evaluatorId: data.evaluatorId,
      invoiceNumber: data.invoiceNumber || null,
      observations: data.observations || null,
      evaluationDate: data.evaluationDate ? evaluationDate : null,
      finalScore,
      classification: classify(finalScore)
    }
  });

  if (finalScore < 60) {
    const nextReview = new Date(evaluationDate);
    nextReview.setDate(nextReview.getDate() + 30);

    const deadline = new Date(evaluationDate);
    deadline.setDate(deadline.getDate() + 30);

    await prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        status: 'BLOQUEADO',
        nextReview
      }
    });

    await prisma.rNC.create({
      data: {
        supplierId: supplier.id,
        description: 'Nota baixa',
        status: 'ABERTA',
        deadline
      }
    });
  }

  return evaluation;
}

module.exports = {
  create
};
