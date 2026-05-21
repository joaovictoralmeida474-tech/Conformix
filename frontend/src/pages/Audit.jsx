import { useCallback, useEffect, useMemo, useState } from "react";
import { cachedGet } from "../services/cachedApi";

const PAGE_SIZE = 20;

const EMPTY_FILTERS = {
  date: "",
  user: "",
  action: "",
  entity: "",
  details: ""
};

function buildPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const result = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(page);
  });

  return result;
}

function normalizeFilters(filters) {
  return {
    date: String(filters.date || "").trim(),
    user: String(filters.user || "").trim(),
    action: String(filters.action || "").trim(),
    entity: String(filters.entity || "").trim(),
    details: String(filters.details || "").trim()
  };
}

function hasActiveFilters(filters) {
  const normalized = normalizeFilters(filters);
  return Object.values(normalized).some(Boolean);
}

function filtersAreEqual(left, right) {
  const a = normalizeFilters(left);
  const b = normalizeFilters(right);
  return (
    a.date === b.date &&
    a.user === b.user &&
    a.action === b.action &&
    a.entity === b.entity &&
    a.details === b.details
  );
}

function formatDateFilterInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export default function Audit() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [queryFilters, setQueryFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filtersActive = useMemo(() => hasActiveFilters(queryFilters), [queryFilters]);

  const loadAudit = useCallback(async (nextPage, activeFilters) => {
    setLoading(true);
    setError("");

    try {
      const normalized = normalizeFilters(activeFilters);
      const params = {
        page: nextPage,
        pageSize: PAGE_SIZE
      };

      if (normalized.date) params.filterDate = normalized.date;
      if (normalized.user) params.filterUser = normalized.user;
      if (normalized.action) params.filterAction = normalized.action;
      if (normalized.entity) params.filterEntity = normalized.entity;
      if (normalized.details) params.filterDetails = normalized.details;

      const response = await cachedGet("/audit", { params }, { force: true });
      const payload = response.data || {};

      setItems(Array.isArray(payload.items) ? payload.items : []);
      setTotal(Number(payload.total) || 0);
      setTotalPages(Number(payload.totalPages) || 0);
      setPage(Number(payload.page) || nextPage);
    } catch {
      setItems([]);
      setTotal(0);
      setTotalPages(0);
      setError("Nao foi possivel carregar a trilha de auditoria.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const normalized = normalizeFilters(filters);
    const delay = hasActiveFilters(normalized) ? 350 : 0;

    const timer = window.setTimeout(() => {
      setQueryFilters((current) => {
        if (filtersAreEqual(current, normalized)) {
          return current;
        }
        return normalized;
      });
      setPage(1);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    loadAudit(page, queryFilters);
  }, [loadAudit, page, queryFilters]);

  const pageNumbers = useMemo(() => buildPageNumbers(page, totalPages), [page, totalPages]);

  const rangeLabel = useMemo(() => {
    if (!total) {
      return filtersActive ? "Nenhum registro encontrado" : "Nenhum registro";
    }

    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    return `Exibindo ${start}-${end} de ${total}`;
  }, [page, total, filtersActive]);

  function updateFilter(key, value) {
    const nextValue = key === "date" ? formatDateFilterInput(value) : value;
    setFilters((current) => ({ ...current, [key]: nextValue }));
  }

  function clearFilters() {
    setFilters({ ...EMPTY_FILTERS });
    setQueryFilters({ ...EMPTY_FILTERS });
    setPage(1);
  }

  function goToPage(nextPage) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }

    setPage(nextPage);
  }

  return (
    <div className="page-grid">
      <header className="page-header">
        <div>
          <span className="badge">Rastreabilidade</span>
          <h1 className="page-title" style={{ marginTop: 10 }}>
            Auditoria
          </h1>
          <p className="page-subtitle">
            Historico de acoes executadas no sistema por usuario e data.
          </p>
        </div>
      </header>

      <section className="table-card audit-table-card">
        <div className="audit-filters-panel">
          <div className="audit-filters-head">
            <div>
              <h2 className="audit-filters-title">Filtros do historico</h2>
              <p className="audit-filters-subtitle">Preencha uma ou mais colunas para refinar a lista.</p>
            </div>
            <button
              type="button"
              className="supplier-filter-button audit-clear-filters-button"
              onClick={clearFilters}
              disabled={!filtersActive && !hasActiveFilters(filters)}
            >
              Limpar filtros
            </button>
          </div>

          <div className="audit-filters-grid">
            <label className="audit-filter-field">
              <span className="audit-filter-label">Data</span>
              <input
                className="audit-column-filter audit-column-filter--date"
                type="text"
                inputMode="numeric"
                placeholder="__/__/____"
                value={filters.date}
                onChange={(event) => updateFilter("date", event.target.value)}
                maxLength={10}
                autoComplete="off"
                aria-label="Filtrar por data no formato dia, mes e ano"
              />
            </label>

            <label className="audit-filter-field">
              <span className="audit-filter-label">Usuario</span>
              <input
                className="audit-column-filter"
                type="search"
                placeholder="E-mail ou nome"
                value={filters.user}
                onChange={(event) => updateFilter("user", event.target.value)}
                aria-label="Filtrar por usuario"
              />
            </label>

            <label className="audit-filter-field">
              <span className="audit-filter-label">Acao</span>
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Tipo de acao"
                value={filters.action}
                onChange={(event) => updateFilter("action", event.target.value)}
                aria-label="Filtrar por acao"
              />
            </label>

            <label className="audit-filter-field">
              <span className="audit-filter-label">Entidade</span>
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Modulo ou registro"
                value={filters.entity}
                onChange={(event) => updateFilter("entity", event.target.value)}
                aria-label="Filtrar por entidade"
              />
            </label>

            <label className="audit-filter-field">
              <span className="audit-filter-label">Detalhes</span>
              <input
                className="audit-column-filter"
                type="search"
                placeholder="Descricao do evento"
                value={filters.details}
                onChange={(event) => updateFilter("details", event.target.value)}
                aria-label="Filtrar por detalhes"
              />
            </label>
          </div>

          <p className="audit-filters-meta">{rangeLabel}</p>
        </div>

        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Usuario</th>
                <th>Acao</th>
                <th>Entidade</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    Carregando historico...
                  </td>
                </tr>
              ) : items.length ? (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
                    <td>{item.user?.email || item.user?.name || "-"}</td>
                    <td>{item.action}</td>
                    <td>{item.entity || "-"}</td>
                    <td>{item.details || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state">
                    {error ||
                      (filtersActive
                        ? "Nenhum resultado para os filtros aplicados."
                        : "Nenhum evento auditado ainda.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 0 ? (
          <footer className="table-pagination" aria-label="Paginacao do historico de auditoria">
            <button
              type="button"
              className="table-pagination-button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
              aria-label="Pagina anterior"
            >
              Anterior
            </button>

            <div className="table-pagination-pages">
              {pageNumbers.map((entry, index) =>
                entry === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="table-pagination-ellipsis">
                    ...
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    className={`table-pagination-button table-pagination-number${
                      entry === page ? " is-active" : ""
                    }`}
                    onClick={() => goToPage(entry)}
                    disabled={loading}
                    aria-label={`Pagina ${entry}`}
                    aria-current={entry === page ? "page" : undefined}
                  >
                    {entry}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="table-pagination-button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || loading}
              aria-label="Proxima pagina"
            >
              Proxima
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
