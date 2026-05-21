import { buildPageNumbers } from "../utils/listTableHelpers";

export default function TablePagination({ page, totalPages, loading, onPageChange, ariaLabel }) {
  const pageNumbers = buildPageNumbers(page, totalPages);

  if (totalPages <= 0) {
    return null;
  }

  return (
    <footer className="table-pagination" aria-label={ariaLabel}>
      <button
        type="button"
        className="table-pagination-button"
        onClick={() => onPageChange(page - 1)}
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
              className={`table-pagination-button table-pagination-number${entry === page ? " is-active" : ""}`}
              onClick={() => onPageChange(entry)}
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
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || loading}
        aria-label="Proxima pagina"
      >
        Proxima
      </button>
    </footer>
  );
}
