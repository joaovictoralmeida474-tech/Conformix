import { useEffect, useMemo, useState } from "react";
import CharLimitedField from "../components/CharLimitedField";
import ListFiltersPanel, { ListFilterField } from "../components/ListFiltersPanel";
import TablePagination from "../components/TablePagination";
import { useStoredUser } from "../hooks/useStoredUser";
import { api } from "../services/api";
import { cachedGet } from "../services/cachedApi";
import { ROLES, normalizeRole } from "../utils/access";
import {
  buildRangeLabel,
  hasActiveFilterValues,
  matchesText,
  paginateItems
} from "../utils/listTableHelpers";

const FIELD_LIMITS = {
  name: 50,
  slug: 80,
  description: 100,
  questions: 100,
  documents: 100
};

const EMPTY_FILTERS = {
  category: "",
  slug: "",
  description: "",
  questions: "",
  documents: "",
  status: ""
};

const initialForm = {
  name: "",
  slug: "",
  description: "",
  companyId: "",
  questions: [],
  documents: [],
  active: true
};

function normalizeCategoryFilters(filters) {
  return {
    category: String(filters.category || "").trim(),
    slug: String(filters.slug || "").trim(),
    description: String(filters.description || "").trim(),
    questions: String(filters.questions || "").trim(),
    documents: String(filters.documents || "").trim(),
    status: String(filters.status || "").trim()
  };
}

function categoryFiltersAreEqual(left, right) {
  const a = normalizeCategoryFilters(left);
  const b = normalizeCategoryFilters(right);
  return (
    a.category === b.category &&
    a.slug === b.slug &&
    a.description === b.description &&
    a.questions === b.questions &&
    a.documents === b.documents &&
    a.status === b.status
  );
}

function filterCategories(items, filters) {
  const activeFilters = normalizeCategoryFilters(filters);

  return items.filter((category) => {
    if (activeFilters.category && !matchesText(category.name, activeFilters.category)) {
      return false;
    }

    if (activeFilters.slug && !matchesText(category.slug, activeFilters.slug)) {
      return false;
    }

    if (activeFilters.description && !matchesText(category.description, activeFilters.description)) {
      return false;
    }

    if (activeFilters.questions) {
      const questionsText = (category.questions || []).map((item) => item.prompt).join(" ");
      const questionsCount = String((category.questions || []).length);
      if (
        !matchesText(questionsText, activeFilters.questions) &&
        !matchesText(questionsCount, activeFilters.questions)
      ) {
        return false;
      }
    }

    if (activeFilters.documents) {
      const documentsText = (category.documents || []).map((item) => item.name).join(" ");
      const documentsCount = String((category.documents || []).length);
      if (
        !matchesText(documentsText, activeFilters.documents) &&
        !matchesText(documentsCount, activeFilters.documents)
      ) {
        return false;
      }
    }

    if (activeFilters.status) {
      const statusLabel = category.active ? "ativa" : "inativa";
      if (!matchesText(statusLabel, activeFilters.status)) {
        return false;
      }
    }

    return true;
  });
}

function parseLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyLines(values = []) {
  return (values || []).join("\n");
}

export default function Categories() {
  const user = useStoredUser();
  const role = normalizeRole(user?.role);
  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [questionText, setQuestionText] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [activePanel, setActivePanel] = useState("list");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [queryFilters, setQueryFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(options = {}) {
    const response = await cachedGet("/categories", {}, options);
    setCategories(response.data);
  }

  async function loadCompanies(options = {}) {
    if (role !== ROLES.SUPER_ADMIN) {
      setCompanies([]);
      return;
    }

    const response = await cachedGet("/admin/settings", {}, options);
    setCompanies(response.data?.companies || []);
  }

  async function saveCategory() {
    try {
      setError("");
      setMessage("");

      const payload = {
        ...form,
        companyId: form.companyId ? Number(form.companyId) : null,
        questions: parseLines(questionText),
        documents: parseLines(documentText)
      };

      if (editingId) {
        const response = await api.put(`/categories/${editingId}`, payload);
        setCategories((current) =>
          current.map((category) => (category.id === response.data.id ? response.data : category))
        );
        setMessage("Categoria atualizada com sucesso.");
      } else {
        const response = await api.post("/categories", payload);
        setCategories((current) =>
          [response.data, ...current].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
        );
        setMessage("Categoria criada com sucesso.");
      }

      setForm(initialForm);
      setQuestionText("");
      setDocumentText("");
      setEditingId(null);
      setActivePanel("list");
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel salvar a categoria.");
    }
  }

  function editCategory(category) {
    setEditingId(category.id);
    setForm({
      name: category.name || "",
      slug: category.slug || "",
      description: category.description || "",
      companyId: category.companyId || "",
      questions: (category.questions || []).map((item) => item.prompt),
      documents: (category.documents || []).map((item) => item.name),
      active: category.active !== false
    });
    setQuestionText(stringifyLines((category.questions || []).map((item) => item.prompt)));
    setDocumentText(stringifyLines((category.documents || []).map((item) => item.name)));
    setActivePanel("form");
    setError("");
    setMessage("");
  }

  function openNewCategory() {
    setEditingId(null);
    setForm(initialForm);
    setQuestionText("");
    setDocumentText("");
    setActivePanel("form");
    setError("");
    setMessage("");
  }

  async function deleteCategory(id) {
    try {
      setError("");
      setMessage("");
      await api.delete(`/categories/${id}`);

      if (editingId === id) {
        setEditingId(null);
        setForm(initialForm);
        setQuestionText("");
        setDocumentText("");
        setActivePanel("list");
      }

      setCategories((current) => current.filter((category) => Number(category.id) !== Number(id)));
      setMessage("Categoria excluida com sucesso.");
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel excluir a categoria.");
    }
  }

  useEffect(() => {
    load();
    loadCompanies().catch(() => null);
  }, [role]);

  useEffect(() => {
    const normalized = normalizeCategoryFilters(filters);
    const delay = hasActiveFilterValues(normalized) ? 350 : 0;

    const timer = window.setTimeout(() => {
      setQueryFilters((current) => {
        if (categoryFiltersAreEqual(current, normalized)) {
          return current;
        }
        return normalized;
      });
      setPage(1);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [filters]);

  const filtersActive = useMemo(() => hasActiveFilterValues(queryFilters), [queryFilters]);

  const filteredCategories = useMemo(
    () => filterCategories(categories, queryFilters),
    [categories, queryFilters]
  );

  const paginatedCategories = useMemo(
    () => paginateItems(filteredCategories, page),
    [filteredCategories, page]
  );

  useEffect(() => {
    if (paginatedCategories.page !== page) {
      setPage(paginatedCategories.page);
    }
  }, [page, paginatedCategories.page]);

  const rangeLabel = useMemo(
    () => buildRangeLabel(paginatedCategories.page, paginatedCategories.total, undefined, filtersActive),
    [paginatedCategories.page, paginatedCategories.total, filtersActive]
  );

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters({ ...EMPTY_FILTERS });
    setQueryFilters({ ...EMPTY_FILTERS });
    setPage(1);
  }

  function goToPage(nextPage) {
    if (
      nextPage < 1 ||
      nextPage > paginatedCategories.totalPages ||
      nextPage === paginatedCategories.page
    ) {
      return;
    }

    setPage(nextPage);
  }

  if (activePanel === "form") {
    return (
      <div className="category-shell">
        <section className="category-form-panel">
          <div className="supplier-form-heading">
            <div>
              <span className="dashboard-card-eyebrow supplier-hero-kicker">Configuracao de categoria</span>
              <h2>{editingId ? "Editar categoria" : "Nova categoria"}</h2>
              <p>
                Cadastre a categoria, as perguntas da avaliacao e os documentos obrigatorios exigidos para os fornecedores dessa categoria.
              </p>
            </div>
            <div className="supplier-hero-actions supplier-hero-actions-right">
              <button
                className="supplier-toolbar-button supplier-toolbar-button-muted"
                type="button"
                onClick={() => setActivePanel("list")}
              >
                Voltar
              </button>
            </div>
          </div>

          <div className="supplier-form-grid">
            <div className="supplier-form-two-columns">
              {role === ROLES.SUPER_ADMIN ? (
                <div className="supplier-form-field">
                  <label>Empresa</label>
                  <select
                    className="supplier-form-input"
                    value={form.companyId}
                    onChange={(event) => setForm((current) => ({ ...current, companyId: event.target.value }))}
                  >
                    <option value="">Selecione uma empresa</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <CharLimitedField
                label="Nome da categoria"
                value={form.name}
                maxLength={FIELD_LIMITS.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
              <CharLimitedField
                label="Codigo interno"
                value={form.slug}
                maxLength={FIELD_LIMITS.slug}
                placeholder="Ex.: alimentacao"
                helperText="Se deixar em branco, o sistema gera o codigo automaticamente."
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              />
            </div>

            <CharLimitedField
              label="Descricao"
              value={form.description}
              maxLength={FIELD_LIMITS.description}
              fullWidth
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />

            <CharLimitedField
              label="Perguntas da avaliacao"
              as="textarea"
              className="category-form-textarea"
              placeholder="Escreva uma pergunta por linha"
              value={questionText}
              maxLength={FIELD_LIMITS.questions}
              fullWidth
              helperText="Exemplo: Qualidade da entrega, cumprimento de prazo, atendimento da equipe."
              onChange={(event) => setQuestionText(event.target.value)}
            />

            <CharLimitedField
              label="Documentos obrigatorios"
              as="textarea"
              className="category-form-textarea"
              placeholder="Escreva um documento por linha"
              value={documentText}
              maxLength={FIELD_LIMITS.documents}
              fullWidth
              helperText="Esses documentos aparecerao automaticamente no cadastro do fornecedor, cada um com campo separado para PDF e vencimento."
              onChange={(event) => setDocumentText(event.target.value)}
            />

            <label className="category-active-toggle">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              />
              <span>Categoria ativa</span>
            </label>

            {error ? <p className="error-text">{error}</p> : null}
            {message ? <p className="success-text">{message}</p> : null}

            <div className="supplier-form-actions">
              <button className="supplier-save-button" type="button" onClick={saveCategory}>
                {editingId ? "Salvar alteracoes" : "Salvar categoria"}
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="category-shell">
      <header className="supplier-hero">
        <div>
          <span className="dashboard-card-eyebrow supplier-hero-kicker">Questionarios por categoria</span>
          <h1>Categorias de fornecedores</h1>
          <p>Cadastre a categoria, as perguntas de avaliacao e os documentos obrigatorios na mesma tela.</p>
        </div>

        <div className="supplier-hero-actions">
          <button className="supplier-toolbar-button supplier-toolbar-button-primary" type="button" onClick={openNewCategory}>
            Nova categoria
          </button>
        </div>
      </header>

      <section className="supplier-list-card">
        <ListFiltersPanel
          title="Filtros das categorias"
          subtitle="Preencha uma ou mais colunas para refinar a lista."
          meta={rangeLabel}
          filtersActive={filtersActive}
          hasDraftFilters={hasActiveFilterValues(filters)}
          onClear={clearFilters}
          gridClassName="audit-filters-grid audit-filters-grid--6"
        >
            <ListFilterField label="Categoria">
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Nome da categoria"
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value)}
                aria-label="Filtrar por categoria"
              />
            </ListFilterField>

            <ListFilterField label="Codigo">
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Codigo interno"
                value={filters.slug}
                onChange={(event) => updateFilter("slug", event.target.value)}
                aria-label="Filtrar por codigo"
              />
            </ListFilterField>

            <ListFilterField label="Descricao">
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Descricao da categoria"
                value={filters.description}
                onChange={(event) => updateFilter("description", event.target.value)}
                aria-label="Filtrar por descricao"
              />
            </ListFilterField>

            <ListFilterField label="Perguntas">
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Texto ou quantidade"
                value={filters.questions}
                onChange={(event) => updateFilter("questions", event.target.value)}
                aria-label="Filtrar por perguntas"
              />
            </ListFilterField>

            <ListFilterField label="Documentos">
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Texto ou quantidade"
                value={filters.documents}
                onChange={(event) => updateFilter("documents", event.target.value)}
                aria-label="Filtrar por documentos"
              />
            </ListFilterField>

            <ListFilterField label="Status">
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Ativa ou inativa"
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value)}
                aria-label="Filtrar por status"
              />
            </ListFilterField>
        </ListFiltersPanel>

        <div className="supplier-table-wrap">
          <table className="supplier-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Codigo</th>
                <th>Perguntas</th>
                <th>Documentos</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCategories.items.length ? (
                paginatedCategories.items.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <strong>{category.name}</strong>
                      <span>{category.description || "-"}</span>
                    </td>
                    <td>{category.slug}</td>
                    <td>{(category.questions || []).length}</td>
                    <td>{(category.documents || []).length}</td>
                    <td>{category.active ? "Ativa" : "Inativa"}</td>
                    <td>
                      <div className="supplier-action-row">
                        <button className="supplier-row-button" type="button" onClick={() => editCategory(category)}>
                          Editar
                        </button>
                        <button
                          className="supplier-row-button supplier-row-button-danger"
                          type="button"
                          onClick={() => deleteCategory(category.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="dashboard-empty-copy">
                    {filtersActive
                      ? "Nenhuma categoria encontrada para os filtros aplicados."
                      : "Nenhuma categoria cadastrada."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={paginatedCategories.page}
          totalPages={paginatedCategories.totalPages}
          loading={false}
          onPageChange={goToPage}
          ariaLabel="Paginacao das categorias"
        />
      </section>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="success-text">{message}</p> : null}
    </div>
  );
}
