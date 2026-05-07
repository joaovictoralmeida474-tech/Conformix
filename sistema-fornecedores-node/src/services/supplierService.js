const prisma = require('../lib/prisma');
const axios = require('axios');

function normalizeCNPJ(cnpj) {
  return (cnpj || '').replace(/\D/g, '');
}

async function list({ search, status }) {
  return await prisma.supplier.findMany({
    where: {
      name: search ? { contains: search } : undefined,
      status: status || undefined
    },
    orderBy: { id: 'desc' },
    include: {
      category: true
    }
  });
}

async function create(data) {
  const cnpj = normalizeCNPJ(data.cnpj);
  const categoryId = Number(data.categoryId);

  const exists = await prisma.supplier.findFirst({
    where: { cnpj }
  });

  if (exists) throw new Error('CNPJ ja cadastrado');
  if (!categoryId) throw new Error('categoryId e obrigatorio');

  return await prisma.supplier.create({
    data: {
      name: data.name,
      cnpj,
      categoryId,
      status: data.status || 'active',
      nextReview: data.nextReview ? new Date(data.nextReview) : null
    },
    include: {
      category: true
    }
  });
}

async function update(id, data) {
  return await prisma.supplier.update({
    where: { id: Number(id) },
    data: {
      name: data.name,
      cnpj: data.cnpj ? normalizeCNPJ(data.cnpj) : undefined,
      categoryId: data.categoryId ? Number(data.categoryId) : undefined,
      status: data.status,
      nextReview: data.nextReview ? new Date(data.nextReview) : undefined
    },
    include: {
      category: true
    }
  });
}

async function remove(id) {
  return await prisma.supplier.delete({
    where: { id: Number(id) }
  });
}

async function detail(id) {
  return await prisma.supplier.findUnique({
    where: { id: Number(id) },
    include: {
      category: true,
      evaluations: true,
      rncs: true
    }
  });
}

async function fetchCNPJ(cnpj) {
  const normalized = normalizeCNPJ(cnpj);

  if (normalized.length !== 14) {
    throw new Error('CNPJ invalido');
  }

  try {
    const response = await axios.get(
      `https://brasilapi.com.br/api/cnpj/v1/${normalized}`
    );

    return response.data;
  } catch (err) {
    throw new Error('Erro ao consultar CNPJ');
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  detail,
  fetchCNPJ
};
