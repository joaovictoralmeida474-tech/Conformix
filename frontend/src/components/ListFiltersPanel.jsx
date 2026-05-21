export default function ListFiltersPanel({
  title,
  subtitle,
  meta,
  filtersActive,
  hasDraftFilters,
  onClear,
  gridClassName = "audit-filters-grid",
  children
}) {
  return (
    <div className="audit-filters-panel">
      <div className="audit-filters-head">
        <div>
          <h2 className="audit-filters-title">{title}</h2>
          <p className="audit-filters-subtitle">{subtitle}</p>
        </div>
        <button
          type="button"
          className="supplier-filter-button audit-clear-filters-button"
          onClick={onClear}
          disabled={!filtersActive && !hasDraftFilters}
        >
          Limpar filtros
        </button>
      </div>

      <div className={gridClassName}>{children}</div>

      {meta ? <p className="audit-filters-meta">{meta}</p> : null}
    </div>
  );
}

export function ListFilterField({ label, children, className = "" }) {
  return (
    <label className={`audit-filter-field${className ? ` ${className}` : ""}`}>
      <span className="audit-filter-label">{label}</span>
      {children}
    </label>
  );
}
