import { prisma } from "../../shared/database/prisma.js";
import { buildCompanyWhere, resolveTargetCompanyId } from "../../shared/auth/dataScope.js";

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeList(values = []) {
  return [...new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function serialize(item) {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    active: item.active,
    companyId: item.companyId,
    questions: (item.questions || [])
      .filter((question) => question.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((question) => ({
        id: question.id,
        prompt: question.prompt,
        sortOrder: question.sortOrder,
        active: question.active
      })),
    documents: (item.documents || [])
      .filter((document) => document.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((document) => ({
        id: document.id,
        name: document.name,
        sortOrder: document.sortOrder,
        active: document.active
      }))
  };
}

export async function list(scope) {
  const items = await prisma.category.findMany({
    where: buildCompanyWhere(scope),
    include: {
      questions: true,
      documents: true
    },
    orderBy: { name: "asc" }
  });

  return items.map(serialize);
}

export async function create(scope, data) {
  const companyId = resolveTargetCompanyId(scope, data.companyId);
  const slug = slugify(data.slug || data.name || "");
  const questions = normalizeList(data.questions);
  const documents = normalizeList(data.documents);

  if (!slug) {
    throw new Error("Slug da categoria invalido");
  }

  const duplicate = await prisma.category.findFirst({
    where: {
      companyId,
      OR: [{ slug }, { name: String(data.name || "").trim() }]
    }
  });

  if (duplicate) {
    throw new Error("Ja existe uma categoria com esse nome ou slug");
  }

  const item = await prisma.category.create({
    data: {
      slug,
      name: String(data.name || "").trim(),
      description: String(data.description || "").trim() || null,
      active: data.active !== false,
      companyId
      ,
      questions: {
        create: questions.map((prompt, index) => ({
          prompt,
          sortOrder: index + 1,
          active: true
        }))
      },
      documents: {
        create: documents.map((name, index) => ({
          name,
          sortOrder: index + 1,
          active: true
        }))
      }
    },
    include: {
      questions: true,
      documents: true
    }
  });

  return serialize(item);
}

export async function update(scope, id, data) {
  const companyId = resolveTargetCompanyId(scope, data.companyId);
  const existing = await prisma.category.findFirst({
    where: {
      id: Number(id),
      ...buildCompanyWhere(scope)
    },
    include: {
      questions: true,
      documents: true
    }
  });

  if (!existing) {
    throw new Error("Categoria nao encontrada");
  }

  const slug = slugify(data.slug || data.name || "");
  const questions = normalizeList(data.questions);
  const documents = normalizeList(data.documents);

  const duplicate = await prisma.category.findFirst({
    where: {
      companyId,
      id: { not: Number(id) },
      OR: [{ slug }, { name: String(data.name || "").trim() }]
    }
  });

  if (duplicate) {
    throw new Error("Ja existe uma categoria com esse nome ou slug");
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id: Number(id) },
      data: {
        slug,
        name: String(data.name || "").trim(),
        description: String(data.description || "").trim() || null,
        active: data.active !== false
      }
    });

    await tx.categoryQuestion.deleteMany({
      where: { categoryId: Number(id) }
    });

    await tx.categoryRequiredDocument.deleteMany({
      where: { categoryId: Number(id) }
    });

    if (questions.length) {
      await tx.categoryQuestion.createMany({
        data: questions.map((prompt, index) => ({
          categoryId: Number(id),
          prompt,
          sortOrder: index + 1,
          active: true
        }))
      });
    }

    if (documents.length) {
      await tx.categoryRequiredDocument.createMany({
        data: documents.map((name, index) => ({
          categoryId: Number(id),
          name,
          sortOrder: index + 1,
          active: true
        }))
      });
    }
  });

  const updated = await prisma.category.findUnique({
    where: { id: Number(id) },
    include: {
      questions: true,
      documents: true
    }
  });

  return serialize(updated);
}

export async function remove(scope, id) {
  const existing = await prisma.category.findFirst({
    where: {
      id: Number(id),
      ...buildCompanyWhere(scope)
    }
  });

  if (!existing) {
    throw new Error("Categoria nao encontrada");
  }

  const linkedSuppliers = await prisma.supplier.count({
    where: {
      ...buildCompanyWhere(scope),
      categoryId: Number(id)
    }
  });

  if (linkedSuppliers) {
    throw new Error("Nao e possivel excluir categoria vinculada a fornecedores");
  }

  await prisma.category.delete({
    where: { id: Number(id) }
  });
}
