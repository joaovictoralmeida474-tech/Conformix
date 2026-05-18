import { buildCompanyWhere, resolveTargetCompanyId } from "../../shared/auth/dataScope.js";
import * as repo from "../../shared/database/supabaseRepo.js";
import { applyCompanyScope, getScopedCompanyId } from "../../shared/database/supabaseScope.js";
import { getSupabaseAdmin, throwIfSupabaseError } from "../../shared/database/supabaseStore.js";
import { loadCategoryBundle } from "../../shared/database/supabaseRelations.js";

const CATEGORY_COLUMNS = "id,slug,name,description,active,companyId";
const CATEGORY_QUESTION_COLUMNS = "id,categoryId,prompt,sortOrder,active";
const CATEGORY_DOCUMENT_COLUMNS = "id,categoryId,name,sortOrder,active";

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

async function listCategoriesForScope(scope) {
  const client = getSupabaseAdmin();
  let query = client.from("Category").select(CATEGORY_COLUMNS).order("name", { ascending: true });
  query = applyCompanyScope(query, scope);

  const categories = throwIfSupabaseError(await query, "listar categorias");

  if (!categories.length) {
    return [];
  }

  const categoryIds = categories.map((item) => item.id);
  const [questions, documents] = await Promise.all([
    throwIfSupabaseError(
      await client
        .from("CategoryQuestion")
        .select(CATEGORY_QUESTION_COLUMNS)
        .in("categoryId", categoryIds)
        .order("sortOrder", { ascending: true }),
      "listar perguntas das categorias"
    ),
    throwIfSupabaseError(
      await client
        .from("CategoryRequiredDocument")
        .select(CATEGORY_DOCUMENT_COLUMNS)
        .in("categoryId", categoryIds)
        .order("sortOrder", { ascending: true }),
      "listar documentos das categorias"
    )
  ]);

  const questionsByCategory = new Map();
  const documentsByCategory = new Map();

  for (const question of questions) {
    if (!questionsByCategory.has(question.categoryId)) {
      questionsByCategory.set(question.categoryId, []);
    }
    questionsByCategory.get(question.categoryId).push(question);
  }

  for (const document of documents) {
    if (!documentsByCategory.has(document.categoryId)) {
      documentsByCategory.set(document.categoryId, []);
    }
    documentsByCategory.get(document.categoryId).push(document);
  }

  return categories.map((item) =>
    serialize({
      ...item,
      questions: questionsByCategory.get(item.id) || [],
      documents: documentsByCategory.get(item.id) || []
    })
  );
}

async function findCategoryInScope(scope, id) {
  const category = await repo.findById("Category", id);

  if (!category) {
    return null;
  }

  const companyId = getScopedCompanyId(scope);

  if (companyId && Number(category.companyId) !== companyId) {
    return null;
  }

  return loadCategoryBundle(category.id);
}

async function findDuplicateCategory(companyId, slug, name, excludeId = null) {
  const client = getSupabaseAdmin();
  const categories = throwIfSupabaseError(
    await client.from("Category").select("id,slug,name").eq("companyId", companyId),
    "buscar categorias da empresa"
  );

  return (
    categories.find((item) => {
      if (excludeId && Number(item.id) === Number(excludeId)) {
        return false;
      }

      return item.slug === slug || item.name === String(name || "").trim();
    }) || null
  );
}

async function replaceCategoryChildren(categoryId, questions, documents) {
  const client = getSupabaseAdmin();

  await repo.deleteWhere("CategoryQuestion", { categoryId: Number(categoryId) });
  await repo.deleteWhere("CategoryRequiredDocument", { categoryId: Number(categoryId) });

  const questionRows = questions.map((prompt, index) => ({
    categoryId: Number(categoryId),
    prompt,
    sortOrder: index + 1,
    active: true
  }));
  const documentRows = documents.map((name, index) => ({
    categoryId: Number(categoryId),
    name,
    sortOrder: index + 1,
    active: true
  }));

  if (questionRows.length) {
    throwIfSupabaseError(
      await client.from("CategoryQuestion").insert(questionRows),
      "salvar perguntas da categoria"
    );
  }

  if (documentRows.length) {
    throwIfSupabaseError(
      await client.from("CategoryRequiredDocument").insert(documentRows),
      "salvar documentos da categoria"
    );
  }
}

export async function list(scope) {
  return listCategoriesForScope(scope);
}

export async function create(scope, data) {
  const companyId = resolveTargetCompanyId(scope, data.companyId);
  const slug = slugify(data.slug || data.name || "");
  const questions = normalizeList(data.questions);
  const documents = normalizeList(data.documents);

  if (!slug) {
    throw new Error("Slug da categoria invalido");
  }

  if (await findDuplicateCategory(companyId, slug, data.name)) {
    throw new Error("Ja existe uma categoria com esse nome ou slug");
  }

  const category = await repo.insertRow("Category", {
    slug,
    name: String(data.name || "").trim(),
    description: String(data.description || "").trim() || null,
    active: data.active !== false,
    companyId
  });

  await replaceCategoryChildren(category.id, questions, documents);
  return serialize(await loadCategoryBundle(category.id));
}

export async function update(scope, id, data) {
  const existing = await findCategoryInScope(scope, id);

  if (!existing) {
    throw new Error("Categoria nao encontrada");
  }

  const companyId = resolveTargetCompanyId(scope, data.companyId || existing.companyId);
  const slug = slugify(data.slug || data.name || "");
  const questions = normalizeList(data.questions);
  const documents = normalizeList(data.documents);

  if (await findDuplicateCategory(companyId, slug, data.name, id)) {
    throw new Error("Ja existe uma categoria com esse nome ou slug");
  }

  await repo.updateRow("Category", id, {
    slug,
    name: String(data.name || "").trim(),
    description: String(data.description || "").trim() || null,
    active: data.active !== false
  });

  await replaceCategoryChildren(id, questions, documents);
  return serialize(await loadCategoryBundle(id));
}

export async function remove(scope, id) {
  const existing = await findCategoryInScope(scope, id);

  if (!existing) {
    throw new Error("Categoria nao encontrada");
  }

  const linkedSuppliers = await repo.countRows("Supplier", {
    ...(buildCompanyWhere(scope) || {}),
    categoryId: Number(id)
  });

  if (linkedSuppliers) {
    throw new Error("Nao e possivel excluir categoria vinculada a fornecedores");
  }

  await repo.deleteWhere("CategoryQuestion", { categoryId: Number(id) });
  await repo.deleteWhere("CategoryRequiredDocument", { categoryId: Number(id) });
  await repo.deleteRow("Category", id);
}
