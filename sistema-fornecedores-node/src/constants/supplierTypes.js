const SUPPLIER_TYPE_LABELS = {
  critical: "Crítico",
  high: "Alto risco",
  intermediate: "Intermediário",
  standard: "Padrão",
  basic: "Básico",
  non_critical: "Não crítico"
};

const SUPPLIER_TYPE_CADENCE_DAYS = {
  critical: 30,
  high: 45,
  intermediate: 90,
  standard: 120,
  basic: 180,
  non_critical: 365
};

module.exports = {
  SUPPLIER_TYPE_LABELS,
  SUPPLIER_TYPE_CADENCE_DAYS
};
