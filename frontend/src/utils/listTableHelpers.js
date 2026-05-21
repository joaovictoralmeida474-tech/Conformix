export const LIST_PAGE_SIZE = 20;

export function buildPageNumbers(currentPage, totalPages) {
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

export function formatDateFilterInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function matchesText(haystack, needle) {
  const normalizedNeedle = String(needle || "").trim().toLowerCase();
  if (!normalizedNeedle) {
    return true;
  }

  return String(haystack ?? "")
    .toLowerCase()
    .includes(normalizedNeedle);
}

export function formatDateBr(value) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "";
}

export function hasActiveFilterValues(filters = {}) {
  return Object.values(filters).some((value) => String(value || "").trim());
}

export function paginateItems(items, page, pageSize = LIST_PAGE_SIZE) {
  const total = items.length;
  const totalPages = total ? Math.ceil(total / pageSize) : 0;
  const safePage = totalPages ? Math.min(Math.max(1, page), totalPages) : 1;
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    totalPages,
    page: safePage
  };
}

export function buildRangeLabel(page, total, pageSize = LIST_PAGE_SIZE, filtersActive = false) {
  if (!total) {
    return filtersActive ? "Nenhum registro encontrado" : "Nenhum registro";
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `Exibindo ${start}-${end} de ${total}`;
}
