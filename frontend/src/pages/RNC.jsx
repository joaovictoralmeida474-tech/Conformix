import { useEffect, useMemo, useState } from "react";
import CharLimitedField from "../components/CharLimitedField";
import ListFiltersPanel, { ListFilterField } from "../components/ListFiltersPanel";
import TablePagination from "../components/TablePagination";
import { useStoredUser } from "../hooks/useStoredUser";
import { api } from "../services/api";
import { cachedGet } from "../services/cachedApi";
import { PERMISSIONS, hasPermission } from "../utils/access";
import {
  buildRangeLabel,
  formatDateBr,
  formatDateFilterInput,
  hasActiveFilterValues,
  matchesText,
  paginateItems
} from "../utils/listTableHelpers";

const FIELD_LIMITS = {
  description: 100,
  cause: 100,
  correctiveAction: 100,
  responsible: 30
};

const EMPTY_FILTERS = {
  supplier: "",
  description: "",
  responsible: "",
  deadline: "",
  status: ""
};

const initialForm = {
  status: "ABERTA",
  description: "",
  cause: "",
  correctiveAction: "",
  responsible: "",
  deadline: "",
  treatmentDate: "",
  supplierStatusAction: ""
};

function normalizeRncFilters(filters) {
  return {
    supplier: String(filters.supplier || "").trim(),
    description: String(filters.description || "").trim(),
    responsible: String(filters.responsible || "").trim(),
    deadline: String(filters.deadline || "").trim(),
    status: String(filters.status || "").trim()
  };
}

function rncFiltersAreEqual(left, right) {
  const a = normalizeRncFilters(left);
  const b = normalizeRncFilters(right);
  return (
    a.supplier === b.supplier &&
    a.description === b.description &&
    a.responsible === b.responsible &&
    a.deadline === b.deadline &&
    a.status === b.status
  );
}

function filterRncItems(items, filters) {
  const activeFilters = normalizeRncFilters(filters);

  return items.filter((item) => {
    if (activeFilters.supplier) {
      const supplierLabel = item.supplier?.name || "";
      const rncLabel = `RNC #${item.id}`;
      if (!matchesText(supplierLabel, activeFilters.supplier) && !matchesText(rncLabel, activeFilters.supplier)) {
        return false;
      }
    }

    if (activeFilters.description && !matchesText(item.description, activeFilters.description)) {
      return false;
    }

    if (activeFilters.responsible && !matchesText(item.responsible, activeFilters.responsible)) {
      return false;
    }

    if (activeFilters.deadline && !matchesText(formatDateBr(item.deadline), activeFilters.deadline)) {
      return false;
    }

    if (activeFilters.status) {
      const statusLabel = formatStatus(item.status);
      if (!matchesText(statusLabel, activeFilters.status) && !matchesText(item.status, activeFilters.status)) {
        return false;
      }
    }

    return true;
  });
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "-";
}

function formatStatus(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "CONCLUIDA" || normalized === "FECHADA") return "Fechado";
  if (normalized === "EM_TRATAMENTO") return "Em tratamento";
  return "Aberto";
}

function isResolvedStatus(value) {
  const normalized = String(value || "").toUpperCase();
  return normalized === "CONCLUIDA" || normalized === "FECHADA";
}

export default function RNC() {
  const currentUser = useStoredUser();
  const canManageRnc = hasPermission(currentUser, PERMISSIONS.RNC_MANAGE);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [queryFilters, setQueryFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(options = {}) {
    try {
      const response = await cachedGet("/rnc", {}, options);
      setItems(response.data);
    } catch (loadError) {
      setError("Nao foi possivel carregar as RNCs.");
    }
  }

  function selectItem(item) {
    setSelectedItem(item);
    setForm({
      status: item.status || "ABERTA",
      description: item.description || "",
      cause: item.cause || "",
      correctiveAction: item.correctiveAction || "",
      responsible: item.responsible || "",
      deadline: item.deadline ? new Date(item.deadline).toISOString().slice(0, 10) : "",
      treatmentDate: item.treatmentDate ? new Date(item.treatmentDate).toISOString().slice(0, 10) : "",
      supplierStatusAction: ""
    });
    setError("");
    setMessage("");
  }

  async function save() {
    if (!selectedItem) return;

    try {
      setError("");
      setMessage("");
      const { data } = await api.put(`/rnc/${selectedItem.id}`, form);
      setItems((current) => current.map((item) => (item.id === data.id ? data : item)));
      setMessage(isResolvedStatus(data.status) ? "RNC atualizada com sucesso." : "Tratativa salva com sucesso.");
      setSelectedItem(null);
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel atualizar a RNC.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const normalized = normalizeRncFilters(filters);
    const delay = hasActiveFilterValues(normalized) ? 350 : 0;

    const timer = window.setTimeout(() => {
      setQueryFilters((current) => {
        if (rncFiltersAreEqual(current, normalized)) {
          return current;
        }
        return normalized;
      });
      setPage(1);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [filters]);

  const filtersActive = useMemo(() => hasActiveFilterValues(queryFilters), [queryFilters]);

  const filteredItems = useMemo(() => filterRncItems(items, queryFilters), [items, queryFilters]);

  const paginatedItems = useMemo(() => paginateItems(filteredItems, page), [filteredItems, page]);

  useEffect(() => {
    if (paginatedItems.page !== page) {
      setPage(paginatedItems.page);
    }
  }, [page, paginatedItems.page]);

  const rangeLabel = useMemo(
    () => buildRangeLabel(paginatedItems.page, paginatedItems.total, undefined, filtersActive),
    [paginatedItems.page, paginatedItems.total, filtersActive]
  );

  function updateFilter(key, value) {
    const nextValue = key === "deadline" ? formatDateFilterInput(value) : value;
    setFilters((current) => ({ ...current, [key]: nextValue }));
  }

  function clearFilters() {
    setFilters({ ...EMPTY_FILTERS });
    setQueryFilters({ ...EMPTY_FILTERS });
    setPage(1);
  }

  function goToPage(nextPage) {
    if (nextPage < 1 || nextPage > paginatedItems.totalPages || nextPage === paginatedItems.page) {
      return;
    }

    setPage(nextPage);
  }

  return (
    <div className="rnc-shell">
      <header className="supplier-hero">
        <div>
          <span className="dashboard-card-eyebrow supplier-hero-kicker">Tratativa de nao conformidades</span>
          <h1>RNC</h1>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="success-text">{message}</p> : null}

      {selectedItem ? (
        <section className="supplier-form-panel rnc-treatment-panel">
          <div className="supplier-form-heading">
            <div>
              <span className="dashboard-card-eyebrow supplier-hero-kicker">
                {isResolvedStatus(selectedItem.status) ? "Edicao de RNC" : "Tratativa de RNC"}
              </span>
              <h2>
                {isResolvedStatus(selectedItem.status)
                  ? `Editar RNC #${selectedItem.id}`
                  : `Tratar RNC #${selectedItem.id}`}
              </h2>
              <p>{selectedItem.supplier?.name || "-"}</p>
            </div>
            <div className="supplier-hero-actions supplier-hero-actions-right">
              <button
                className="supplier-toolbar-button supplier-toolbar-button-muted"
                type="button"
                onClick={() => setSelectedItem(null)}
              >
                Voltar
              </button>
            </div>
          </div>

          <div className="supplier-form-grid">
            <CharLimitedField
              label="Descricao"
              as="textarea"
              className="supplier-form-textarea"
              value={form.description}
              maxLength={FIELD_LIMITS.description}
              fullWidth
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />

            <CharLimitedField
              label="Causa raiz"
              as="textarea"
              className="supplier-form-textarea"
              value={form.cause}
              maxLength={FIELD_LIMITS.cause}
              fullWidth
              onChange={(event) => setForm({ ...form, cause: event.target.value })}
            />

            <CharLimitedField
              label="Acao corretiva"
              as="textarea"
              className="supplier-form-textarea"
              value={form.correctiveAction}
              maxLength={FIELD_LIMITS.correctiveAction}
              fullWidth
              onChange={(event) => setForm({ ...form, correctiveAction: event.target.value })}
            />

            <div className="supplier-form-two-columns">
              <CharLimitedField
                label="Responsavel"
                value={form.responsible}
                maxLength={FIELD_LIMITS.responsible}
                onChange={(event) => setForm({ ...form, responsible: event.target.value })}
              />
              <div className="supplier-form-field">
                <label>Prazo</label>
                <input
                  className="supplier-form-input"
                  type="date"
                  value={form.deadline}
                  onChange={(event) => setForm({ ...form, deadline: event.target.value })}
                />
              </div>
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Data da tratativa</label>
                <input
                  className="supplier-form-input"
                  type="date"
                  value={form.treatmentDate}
                  onChange={(event) => setForm({ ...form, treatmentDate: event.target.value })}
                />
              </div>

              <div className="supplier-form-field">
                <label>Status</label>
                <select
                  className="supplier-form-input"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  <option value="ABERTA">Aberta</option>
                  <option value="EM_TRATAMENTO">Em tratamento</option>
                  <option value="CONCLUIDA">Concluida</option>
                </select>
              </div>
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Acao no status do fornecedor</label>
              <select
                className="supplier-form-input"
                value={form.supplierStatusAction}
                onChange={(event) => setForm({ ...form, supplierStatusAction: event.target.value })}
              >
                <option value="">Manter status atual</option>
                <option value="ATIVO">Ativar fornecedor</option>
                <option value="BLOQUEADO">Bloquear fornecedor</option>
              </select>
            </div>

            <div className="supplier-form-actions">
              <button className="supplier-save-button" type="button" onClick={save}>
                {isResolvedStatus(selectedItem.status) ? "Salvar edicao" : "Salvar tratativa"}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="supplier-list-card">
          <ListFiltersPanel
            title="Filtros das RNCs"
            subtitle="Preencha uma ou mais colunas para refinar a lista."
            meta={rangeLabel}
            filtersActive={filtersActive}
            hasDraftFilters={hasActiveFilterValues(filters)}
            onClear={clearFilters}
          >
            <ListFilterField label="Fornecedor">
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Nome ou numero da RNC"
                value={filters.supplier}
                onChange={(event) => updateFilter("supplier", event.target.value)}
                aria-label="Filtrar por fornecedor"
              />
            </ListFilterField>

            <ListFilterField label="Descricao">
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Descricao da RNC"
                value={filters.description}
                onChange={(event) => updateFilter("description", event.target.value)}
                aria-label="Filtrar por descricao"
              />
            </ListFilterField>

            <ListFilterField label="Responsavel">
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Nome do responsavel"
                value={filters.responsible}
                onChange={(event) => updateFilter("responsible", event.target.value)}
                aria-label="Filtrar por responsavel"
              />
            </ListFilterField>

            <ListFilterField label="Prazo">
              <input
                className="audit-column-filter audit-column-filter--date"
                type="text"
                inputMode="numeric"
                placeholder="__/__/____"
                value={filters.deadline}
                onChange={(event) => updateFilter("deadline", event.target.value)}
                maxLength={10}
                autoComplete="off"
                aria-label="Filtrar por prazo no formato dia, mes e ano"
              />
            </ListFilterField>

            <ListFilterField label="Status">
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Aberto, tratamento ou fechado"
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
                  <th>Fornecedor</th>
                  <th>Descricao</th>
                  <th>Responsavel</th>
                  <th>Prazo</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.items.length ? (
                  paginatedItems.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.supplier?.name || "-"}</strong>
                        <span>RNC #{item.id}</span>
                      </td>
                      <td>{item.description || "RNC sem descricao."}</td>
                      <td>{item.responsible || "-"}</td>
                      <td>{formatDate(item.deadline)}</td>
                      <td>{formatStatus(item.status)}</td>
                      <td>
                        <div className="supplier-action-row">
                          {canManageRnc ? (
                            <button
                              className="supplier-row-button"
                              type="button"
                              onClick={() => selectItem(item)}
                            >
                              {isResolvedStatus(item.status) ? "Editar" : "Tratar"}
                            </button>
                          ) : (
                            <span className="dashboard-empty-copy">Somente leitura</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="dashboard-empty-copy">
                      {filtersActive
                        ? "Nenhuma RNC encontrada para os filtros aplicados."
                        : "Nenhuma RNC encontrada."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={paginatedItems.page}
            totalPages={paginatedItems.totalPages}
            loading={false}
            onPageChange={goToPage}
            ariaLabel="Paginacao das RNCs"
          />
        </section>
      )}
    </div>
  );
}
