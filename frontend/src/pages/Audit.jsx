import { useCallback, useEffect, useMemo, useState } from "react";
import { cachedGet } from "../services/cachedApi";

const PAGE_SIZE = 20;

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

export default function Audit() {
  const [items, setItems] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAudit = useCallback(async (nextPage, term) => {
    setLoading(true);
    setError("");

    try {
      const response = await cachedGet("/audit", {
        params: {
          page: nextPage,
          pageSize: PAGE_SIZE,
          search: term || undefined
        }
      });
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
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadAudit(page, searchTerm);
  }, [loadAudit, page, searchTerm]);

  const pageNumbers = useMemo(() => buildPageNumbers(page, totalPages), [page, totalPages]);

  const rangeLabel = useMemo(() => {
    if (!total) {
      return "Nenhum registro";
    }

    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    return `Exibindo ${start}-${end} de ${total}`;
  }, [page, total]);

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
        <div className="audit-toolbar">
          <label className="audit-search-field">
            <span className="audit-search-label">Pesquisar</span>
            <input
              className="supplier-filter-input audit-search-input"
              type="search"
              placeholder="Buscar por data, usuario, acao, entidade ou detalhes..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Pesquisar historico de auditoria"
            />
          </label>
          <p className="audit-search-hint">{rangeLabel}</p>
        </div>

        <div className="audit-table-wrap">
          <table>
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
                    {error || (searchTerm ? "Nenhum resultado para esta pesquisa." : "Nenhum evento auditado ainda.")}
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
