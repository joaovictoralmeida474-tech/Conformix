import { useEffect, useMemo, useState } from "react";
import ListFiltersPanel, { ListFilterField } from "../components/ListFiltersPanel";
import TablePagination from "../components/TablePagination";
import { useStoredUser } from "../hooks/useStoredUser";
import { api } from "../services/api";
import { cachedGet } from "../services/cachedApi";
import { PERMISSIONS, hasPermission } from "../utils/access";
import {
  buildRangeLabel,
  hasActiveFilterValues,
  matchesText,
  paginateItems
} from "../utils/listTableHelpers";

const EMPTY_FILTERS = {
  number: "",
  supplier: "",
  periodFrom: "",
  periodTo: "",
  status: ""
};

const STATUS_OPTIONS = [
  { value: "EM_ANALISE", label: "Em analise", badge: "nfs-status-review" },
  { value: "APROVADA", label: "Aprovada", badge: "nfs-status-approved" },
  { value: "COM_PENDENCIA", label: "Com pendencia", badge: "nfs-status-pending" },
  { value: "CANCELADA", label: "Cancelada", badge: "nfs-status-cancelled" }
];

const initialForm = {
  number: "",
  series: "",
  supplierId: "",
  serviceDescription: "",
  contractReference: "",
  observations: "",
  issueDate: "",
  competenceDate: "",
  grossAmount: "",
  discountAmount: "",
  netAmount: "",
  issAmount: "",
  inssAmount: "",
  irAmount: "",
  pisAmount: "",
  cofinsAmount: "",
  csllAmount: "",
  status: "EM_ANALISE"
};

function normalizeFilters(filters) {
  return {
    number: String(filters.number || "").trim(),
    supplier: String(filters.supplier || "").trim(),
    periodFrom: String(filters.periodFrom || "").trim(),
    periodTo: String(filters.periodTo || "").trim(),
    status: String(filters.status || "").trim()
  };
}

function filtersAreEqual(left, right) {
  const a = normalizeFilters(left);
  const b = normalizeFilters(right);
  return (
    a.number === b.number &&
    a.supplier === b.supplier &&
    a.periodFrom === b.periodFrom &&
    a.periodTo === b.periodTo &&
    a.status === b.status
  );
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "-";
}

function formatCnpj(value) {
  const cleaned = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 14);
  return cleaned
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatStatus(value) {
  const found = STATUS_OPTIONS.find((item) => item.value === String(value || "").toUpperCase());
  return found?.label || value || "-";
}

function statusBadgeClass(value) {
  const found = STATUS_OPTIONS.find((item) => item.value === String(value || "").toUpperCase());
  return found?.badge || "";
}

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toAmountInput(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function parseAmountField(value) {
  if (value === "" || value === null || value === undefined) return "";
  return value;
}

function filterInvoiceItems(items, filters) {
  const active = normalizeFilters(filters);

  return items.filter((item) => {
    if (active.number) {
      const numberLabel = `${item.number || ""}${item.series ? `/${item.series}` : ""}`;
      if (!matchesText(numberLabel, active.number) && !matchesText(item.number, active.number)) {
        return false;
      }
    }

    if (active.supplier && !matchesText(item.supplier?.name || "", active.supplier)) {
      return false;
    }

    if (active.status) {
      const statusLabel = formatStatus(item.status);
      if (!matchesText(statusLabel, active.status) && !matchesText(item.status, active.status)) {
        return false;
      }
    }

    const issueTime = item.issueDate ? new Date(item.issueDate).getTime() : NaN;

    if (active.periodFrom) {
      const from = new Date(`${active.periodFrom}T00:00:00`).getTime();
      if (!Number.isFinite(issueTime) || issueTime < from) {
        return false;
      }
    }

    if (active.periodTo) {
      const to = new Date(`${active.periodTo}T23:59:59`).getTime();
      if (!Number.isFinite(issueTime) || issueTime > to) {
        return false;
      }
    }

    return true;
  });
}

function getDownloadFilename(contentDisposition, fallbackName) {
  const rawHeader = String(contentDisposition || "");
  const utf8Match = rawHeader.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const quotedMatch = rawHeader.match(/filename\s*=\s*"([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  return fallbackName;
}

export default function Nfs() {
  const currentUser = useStoredUser();
  const canManage = hasPermission(currentUser, PERMISSIONS.NFS_MANAGE);

  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [panel, setPanel] = useState("list");
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [pdfFile, setPdfFile] = useState(null);
  const [xmlFile, setXmlFile] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [queryFilters, setQueryFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load(options = {}) {
    try {
      const [invoicesResponse, suppliersResponse] = await Promise.all([
        cachedGet("/nfs", {}, options),
        cachedGet("/suppliers", {}, options)
      ]);
      setItems(Array.isArray(invoicesResponse.data) ? invoicesResponse.data : []);
      setSuppliers(Array.isArray(suppliersResponse.data) ? suppliersResponse.data : []);
    } catch {
      setError("Nao foi possivel carregar as notas fiscais.");
    }
  }

  function openCreate() {
    setSelectedItem(null);
    setForm({ ...initialForm });
    setPdfFile(null);
    setXmlFile(null);
    setError("");
    setMessage("");
    setPanel("form");
  }

  function openEdit(item) {
    setSelectedItem(item);
    setForm({
      number: item.number || "",
      series: item.series || "",
      supplierId: item.supplierId ? String(item.supplierId) : "",
      serviceDescription: item.serviceDescription || "",
      contractReference: item.contractReference || "",
      observations: item.observations || "",
      issueDate: toDateInput(item.issueDate),
      competenceDate: toDateInput(item.competenceDate),
      grossAmount: toAmountInput(item.grossAmount),
      discountAmount: toAmountInput(item.discountAmount),
      netAmount: toAmountInput(item.netAmount),
      issAmount: toAmountInput(item.issAmount),
      inssAmount: toAmountInput(item.inssAmount),
      irAmount: toAmountInput(item.irAmount),
      pisAmount: toAmountInput(item.pisAmount),
      cofinsAmount: toAmountInput(item.cofinsAmount),
      csllAmount: toAmountInput(item.csllAmount),
      status: item.status || "EM_ANALISE"
    });
    setPdfFile(null);
    setXmlFile(null);
    setError("");
    setMessage("");
    setPanel("form");
  }

  function openDetails(item) {
    setSelectedItem(item);
    setError("");
    setMessage("");
    setPanel("details");
  }

  function backToList() {
    setPanel("list");
    setSelectedItem(null);
    setPdfFile(null);
    setXmlFile(null);
  }

  function buildPayload() {
    return {
      number: form.number,
      series: form.series,
      supplierId: Number(form.supplierId),
      serviceDescription: form.serviceDescription,
      contractReference: form.contractReference,
      observations: form.observations,
      issueDate: form.issueDate,
      competenceDate: form.competenceDate || null,
      grossAmount: parseAmountField(form.grossAmount),
      discountAmount: parseAmountField(form.discountAmount),
      netAmount: parseAmountField(form.netAmount),
      issAmount: parseAmountField(form.issAmount),
      inssAmount: parseAmountField(form.inssAmount),
      irAmount: parseAmountField(form.irAmount),
      pisAmount: parseAmountField(form.pisAmount),
      cofinsAmount: parseAmountField(form.cofinsAmount),
      csllAmount: parseAmountField(form.csllAmount),
      status: form.status
    };
  }

  async function uploadFiles(invoiceId) {
    if (!pdfFile && !xmlFile) {
      return null;
    }

    const formData = new FormData();
    if (pdfFile) formData.append("pdfFile", pdfFile);
    if (xmlFile) formData.append("xmlFile", xmlFile);

    const { data } = await api.post(`/nfs/${invoiceId}/files`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  }

  async function save() {
    if (!canManage) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (!form.number.trim()) {
        setError("Informe o numero da NF.");
        return;
      }

      if (!form.supplierId) {
        setError("Selecione o prestador.");
        return;
      }

      if (!form.issueDate) {
        setError("Informe a data de emissao.");
        return;
      }

      const payload = buildPayload();
      let saved;

      if (selectedItem?.id) {
        const { data } = await api.put(`/nfs/${selectedItem.id}`, payload);
        saved = data;
      } else {
        const { data } = await api.post("/nfs", payload);
        saved = data;
      }

      if (pdfFile || xmlFile) {
        saved = (await uploadFiles(saved.id)) || saved;
      }

      setItems((current) => {
        const exists = current.some((item) => item.id === saved.id);
        if (exists) {
          return current.map((item) => (item.id === saved.id ? saved : item));
        }
        return [saved, ...current];
      });

      setSelectedItem(saved);
      setPdfFile(null);
      setXmlFile(null);
      setMessage(selectedItem?.id ? "Nota fiscal atualizada." : "Nota fiscal cadastrada.");
      setPanel("details");
      void load({ force: true });
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel salvar a nota fiscal.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(nextStatus) {
    if (!canManage || !selectedItem?.id) return;

    try {
      setError("");
      setMessage("");
      const { data } = await api.patch(`/nfs/${selectedItem.id}/status`, { status: nextStatus });
      setSelectedItem(data);
      setItems((current) => current.map((item) => (item.id === data.id ? data : item)));
      setMessage("Status atualizado.");
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel alterar o status.");
    }
  }

  async function replaceFiles() {
    if (!canManage || !selectedItem?.id) return;
    if (!pdfFile && !xmlFile) {
      setError("Selecione um PDF e/ou XML para anexar.");
      return;
    }

    try {
      setError("");
      setMessage("");
      const data = await uploadFiles(selectedItem.id);
      if (data) {
        setSelectedItem(data);
        setItems((current) => current.map((item) => (item.id === data.id ? data : item)));
        setPdfFile(null);
        setXmlFile(null);
        setMessage("Arquivos atualizados.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel anexar os arquivos.");
    }
  }

  async function removeFile(kind) {
    if (!canManage || !selectedItem?.id) return;

    try {
      setError("");
      setMessage("");
      const { data } = await api.delete(`/nfs/${selectedItem.id}/files/${kind}`);
      setSelectedItem(data);
      setItems((current) => current.map((item) => (item.id === data.id ? data : item)));
      setMessage(`Arquivo ${kind.toUpperCase()} removido.`);
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel remover o arquivo.");
    }
  }

  async function downloadFile(kind, fallbackName) {
    if (!selectedItem?.id) return;

    try {
      setError("");
      const response = await api.get(`/nfs/${selectedItem.id}/files/${kind}/download`, {
        responseType: "blob"
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = getDownloadFilename(response.headers["content-disposition"], fallbackName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setError("Nao foi possivel baixar o arquivo.");
    }
  }

  async function removeInvoice() {
    if (!canManage || !selectedItem?.id) return;
    if (!window.confirm("Excluir esta nota fiscal?")) return;

    try {
      setError("");
      await api.delete(`/nfs/${selectedItem.id}`);
      setItems((current) => current.filter((item) => item.id !== selectedItem.id));
      setMessage("Nota fiscal excluida.");
      backToList();
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel excluir a nota.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const normalized = normalizeFilters(filters);
    const delay = hasActiveFilterValues(normalized) ? 350 : 0;
    const timer = window.setTimeout(() => {
      setQueryFilters((current) => (filtersAreEqual(current, normalized) ? current : normalized));
      setPage(1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const filtersActive = useMemo(() => hasActiveFilterValues(queryFilters), [queryFilters]);
  const filteredItems = useMemo(() => filterInvoiceItems(items, queryFilters), [items, queryFilters]);
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
    setFilters((current) => ({ ...current, [key]: value }));
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

  function updateForm(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "grossAmount" || key === "discountAmount") {
        const gross = Number(key === "grossAmount" ? value : next.grossAmount);
        const discount = Number(key === "discountAmount" ? value : next.discountAmount);
        if (Number.isFinite(gross) && Number.isFinite(discount)) {
          next.netAmount = String(Math.max(0, gross - discount));
        }
      }
      return next;
    });
  }

  if (panel === "form") {
    return (
      <div className="rnc-shell">
        <section className="supplier-form-panel">
          <div className="supplier-form-heading">
            <div>
              <span className="dashboard-card-eyebrow supplier-hero-kicker">Notas fiscais de servicos</span>
              <h2>{selectedItem?.id ? `Editar NF ${selectedItem.number}` : "Cadastrar nota fiscal"}</h2>
              <p>Vincule a NF a um prestador ja cadastrado e registre os dados basicos.</p>
            </div>
            <div className="supplier-hero-actions supplier-hero-actions-right">
              <button
                className="supplier-toolbar-button supplier-toolbar-button-muted"
                type="button"
                onClick={selectedItem?.id ? () => openDetails(selectedItem) : backToList}
              >
                Voltar
              </button>
            </div>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}

          <div className="supplier-form-grid">
            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Numero da NF</label>
                <input
                  className="supplier-form-input"
                  value={form.number}
                  onChange={(event) => updateForm("number", event.target.value)}
                />
              </div>
              <div className="supplier-form-field">
                <label>Serie</label>
                <input
                  className="supplier-form-input"
                  value={form.series}
                  onChange={(event) => updateForm("series", event.target.value)}
                />
              </div>
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Data de emissao</label>
                <input
                  className="supplier-form-input"
                  type="date"
                  value={form.issueDate}
                  onChange={(event) => updateForm("issueDate", event.target.value)}
                />
              </div>
              <div className="supplier-form-field">
                <label>Competencia do servico</label>
                <input
                  className="supplier-form-input"
                  type="date"
                  value={form.competenceDate}
                  onChange={(event) => updateForm("competenceDate", event.target.value)}
                />
              </div>
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Prestador (fornecedor cadastrado)</label>
              <select
                className="supplier-form-input"
                value={form.supplierId}
                onChange={(event) => updateForm("supplierId", event.target.value)}
              >
                <option value="">Selecione o prestador pelo cadastro / CNPJ</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                    {supplier.cnpj ? ` · ${formatCnpj(supplier.cnpj)}` : ""}
                  </option>
                ))}
              </select>
              <p className="dashboard-empty-copy" style={{ marginTop: "0.45rem" }}>
                A NF fica automaticamente vinculada ao fornecedor selecionado e aparece no dossie dele.
              </p>
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Tipo / descricao do servico</label>
              <textarea
                className="supplier-form-textarea"
                rows={3}
                value={form.serviceDescription}
                onChange={(event) => updateForm("serviceDescription", event.target.value)}
              />
            </div>

            <div className="supplier-form-field">
              <label>Contrato (referencia)</label>
              <input
                className="supplier-form-input"
                value={form.contractReference}
                onChange={(event) => updateForm("contractReference", event.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Valor bruto</label>
                <input
                  className="supplier-form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.grossAmount}
                  onChange={(event) => updateForm("grossAmount", event.target.value)}
                />
              </div>
              <div className="supplier-form-field">
                <label>Descontos</label>
                <input
                  className="supplier-form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.discountAmount}
                  onChange={(event) => updateForm("discountAmount", event.target.value)}
                />
              </div>
            </div>

            <div className="supplier-form-field">
              <label>Valor liquido</label>
              <input
                className="supplier-form-input"
                type="number"
                step="0.01"
                min="0"
                value={form.netAmount}
                onChange={(event) => updateForm("netAmount", event.target.value)}
              />
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>ISS</label>
                <input
                  className="supplier-form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.issAmount}
                  onChange={(event) => updateForm("issAmount", event.target.value)}
                />
              </div>
              <div className="supplier-form-field">
                <label>INSS</label>
                <input
                  className="supplier-form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.inssAmount}
                  onChange={(event) => updateForm("inssAmount", event.target.value)}
                />
              </div>
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>IR</label>
                <input
                  className="supplier-form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.irAmount}
                  onChange={(event) => updateForm("irAmount", event.target.value)}
                />
              </div>
              <div className="supplier-form-field">
                <label>PIS</label>
                <input
                  className="supplier-form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.pisAmount}
                  onChange={(event) => updateForm("pisAmount", event.target.value)}
                />
              </div>
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>COFINS</label>
                <input
                  className="supplier-form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.cofinsAmount}
                  onChange={(event) => updateForm("cofinsAmount", event.target.value)}
                />
              </div>
              <div className="supplier-form-field">
                <label>CSLL</label>
                <input
                  className="supplier-form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.csllAmount}
                  onChange={(event) => updateForm("csllAmount", event.target.value)}
                />
              </div>
            </div>

            <div className="supplier-form-field">
              <label>Status</label>
              <select
                className="supplier-form-input"
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Observacoes</label>
              <textarea
                className="supplier-form-textarea"
                rows={3}
                value={form.observations}
                onChange={(event) => updateForm("observations", event.target.value)}
              />
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>PDF da nota</label>
                <input
                  className="supplier-form-input"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
                />
              </div>
              <div className="supplier-form-field">
                <label>XML da nota</label>
                <input
                  className="supplier-form-input"
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={(event) => setXmlFile(event.target.files?.[0] || null)}
                />
              </div>
            </div>

            {canManage ? (
              <div className="supplier-form-actions">
                <button className="supplier-save-button" type="button" onClick={save} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar nota fiscal"}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  if (panel === "details" && selectedItem) {
    return (
      <div className="rnc-shell">
        <section className="supplier-form-panel">
          <div className="supplier-form-heading">
            <div>
              <span className="dashboard-card-eyebrow supplier-hero-kicker">Detalhes da nota</span>
              <h2>
                NF {selectedItem.number}
                {selectedItem.series ? ` / ${selectedItem.series}` : ""}
              </h2>
              <p>{selectedItem.supplier?.name || "Prestador nao informado"}</p>
            </div>
            <div className="supplier-hero-actions supplier-hero-actions-right">
              <button
                className="supplier-toolbar-button supplier-toolbar-button-muted"
                type="button"
                onClick={backToList}
              >
                Voltar
              </button>
              {canManage ? (
                <button className="supplier-toolbar-button" type="button" onClick={() => openEdit(selectedItem)}>
                  Editar
                </button>
              ) : null}
            </div>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}

          <div className="supplier-dossier-data-table" style={{ marginBottom: "1.25rem" }}>
            <div>
              <span>Status</span>
              <strong className={statusBadgeClass(selectedItem.status)}>{formatStatus(selectedItem.status)}</strong>
            </div>
            <div>
              <span>Emissao</span>
              <strong>{formatDate(selectedItem.issueDate)}</strong>
            </div>
            <div>
              <span>Competencia</span>
              <strong>{formatDate(selectedItem.competenceDate)}</strong>
            </div>
            <div>
              <span>Valor liquido</span>
              <strong>{formatMoney(selectedItem.netAmount)}</strong>
            </div>
            <div>
              <span>Valor bruto</span>
              <strong>{formatMoney(selectedItem.grossAmount)}</strong>
            </div>
            <div>
              <span>Descontos</span>
              <strong>{formatMoney(selectedItem.discountAmount)}</strong>
            </div>
            <div>
              <span>Servico</span>
              <strong>{selectedItem.serviceDescription || "-"}</strong>
            </div>
            <div>
              <span>Contrato</span>
              <strong>{selectedItem.contractReference || "-"}</strong>
            </div>
          </div>

          <div className="supplier-dossier-data-table" style={{ marginBottom: "1.25rem" }}>
            <div>
              <span>ISS</span>
              <strong>{selectedItem.issAmount != null ? formatMoney(selectedItem.issAmount) : "-"}</strong>
            </div>
            <div>
              <span>INSS</span>
              <strong>{selectedItem.inssAmount != null ? formatMoney(selectedItem.inssAmount) : "-"}</strong>
            </div>
            <div>
              <span>IR</span>
              <strong>{selectedItem.irAmount != null ? formatMoney(selectedItem.irAmount) : "-"}</strong>
            </div>
            <div>
              <span>PIS</span>
              <strong>{selectedItem.pisAmount != null ? formatMoney(selectedItem.pisAmount) : "-"}</strong>
            </div>
            <div>
              <span>COFINS</span>
              <strong>{selectedItem.cofinsAmount != null ? formatMoney(selectedItem.cofinsAmount) : "-"}</strong>
            </div>
            <div>
              <span>CSLL</span>
              <strong>{selectedItem.csllAmount != null ? formatMoney(selectedItem.csllAmount) : "-"}</strong>
            </div>
          </div>

          {selectedItem.observations ? (
            <p className="dashboard-empty-copy" style={{ marginBottom: "1.25rem" }}>
              {selectedItem.observations}
            </p>
          ) : null}

          {canManage ? (
            <div className="supplier-form-field" style={{ marginBottom: "1.25rem" }}>
              <label>Alterar status</label>
              <select
                className="supplier-form-input"
                value={selectedItem.status || "EM_ANALISE"}
                onChange={(event) => changeStatus(event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <section className="supplier-dossier-card" style={{ marginBottom: "1.25rem" }}>
            <h2>Anexos</h2>
            <div className="supplier-action-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
              {selectedItem.pdfFilename ? (
                <>
                  <button
                    className="supplier-row-button"
                    type="button"
                    onClick={() =>
                      downloadFile("pdf", selectedItem.pdfOriginalName || `nf-${selectedItem.number}.pdf`)
                    }
                  >
                    Baixar PDF
                  </button>
                  {canManage ? (
                    <button className="supplier-row-button" type="button" onClick={() => removeFile("pdf")}>
                      Excluir PDF
                    </button>
                  ) : null}
                </>
              ) : (
                <span className="dashboard-empty-copy">PDF nao anexado</span>
              )}

              {selectedItem.xmlFilename ? (
                <>
                  <button
                    className="supplier-row-button"
                    type="button"
                    onClick={() =>
                      downloadFile("xml", selectedItem.xmlOriginalName || `nf-${selectedItem.number}.xml`)
                    }
                  >
                    Baixar XML
                  </button>
                  {canManage ? (
                    <button className="supplier-row-button" type="button" onClick={() => removeFile("xml")}>
                      Excluir XML
                    </button>
                  ) : null}
                </>
              ) : (
                <span className="dashboard-empty-copy">XML nao anexado</span>
              )}
            </div>

            {canManage ? (
              <div className="supplier-form-two-columns" style={{ marginTop: "1rem" }}>
                <div className="supplier-form-field">
                  <label>Substituir / anexar PDF</label>
                  <input
                    className="supplier-form-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
                  />
                </div>
                <div className="supplier-form-field">
                  <label>Substituir / anexar XML</label>
                  <input
                    className="supplier-form-input"
                    type="file"
                    accept=".xml,text/xml,application/xml"
                    onChange={(event) => setXmlFile(event.target.files?.[0] || null)}
                  />
                </div>
                <div className="supplier-form-actions">
                  <button className="supplier-save-button" type="button" onClick={replaceFiles}>
                    Salvar anexos
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {canManage ? (
            <div className="supplier-form-actions">
              <button
                className="supplier-toolbar-button supplier-toolbar-button-muted"
                type="button"
                onClick={removeInvoice}
              >
                Excluir nota
              </button>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="rnc-shell">
      <header className="supplier-hero">
        <div>
          <span className="dashboard-card-eyebrow supplier-hero-kicker">Gestao de notas fiscais de servicos</span>
          <h1>Notas Fiscais</h1>
        </div>
        {canManage ? (
          <div className="supplier-hero-actions">
            <button className="supplier-toolbar-button supplier-toolbar-button-primary" type="button" onClick={openCreate}>
              Nova nota
            </button>
          </div>
        ) : null}
      </header>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="success-text">{message}</p> : null}

      <section className="supplier-list-card">
        <ListFiltersPanel
          title="Filtros das notas"
          subtitle="Filtre por numero, prestador, periodo ou status."
          meta={rangeLabel}
          filtersActive={filtersActive}
          hasDraftFilters={hasActiveFilterValues(filters)}
          onClear={clearFilters}
        >
          <ListFilterField label="Numero da NF">
            <input
              className="audit-column-filter"
              type="search"
              placeholder="Numero ou serie"
              value={filters.number}
              onChange={(event) => updateFilter("number", event.target.value)}
              aria-label="Filtrar por numero da NF"
            />
          </ListFilterField>

          <ListFilterField label="Prestador">
            <input
              className="audit-column-filter"
              type="search"
              placeholder="Nome do prestador"
              value={filters.supplier}
              onChange={(event) => updateFilter("supplier", event.target.value)}
              aria-label="Filtrar por prestador"
            />
          </ListFilterField>

          <ListFilterField label="Periodo de">
            <input
              className="audit-column-filter"
              type="date"
              value={filters.periodFrom}
              onChange={(event) => updateFilter("periodFrom", event.target.value)}
              aria-label="Filtrar por data inicial"
            />
          </ListFilterField>

          <ListFilterField label="Periodo ate">
            <input
              className="audit-column-filter"
              type="date"
              value={filters.periodTo}
              onChange={(event) => updateFilter("periodTo", event.target.value)}
              aria-label="Filtrar por data final"
            />
          </ListFilterField>

          <ListFilterField label="Status">
            <input
              className="audit-column-filter"
              type="search"
              placeholder="Em analise, aprovada..."
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
                <th>Numero</th>
                <th>Prestador</th>
                <th>Servico</th>
                <th>Emissao</th>
                <th>Competencia</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.items.length ? (
                paginatedItems.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.number}
                        {item.series ? ` / ${item.series}` : ""}
                      </strong>
                    </td>
                    <td>{item.supplier?.name || "-"}</td>
                    <td>{item.serviceDescription || "-"}</td>
                    <td>{formatDate(item.issueDate)}</td>
                    <td>{formatDate(item.competenceDate)}</td>
                    <td>{formatMoney(item.netAmount)}</td>
                    <td>
                      <span className={statusBadgeClass(item.status)}>{formatStatus(item.status)}</span>
                    </td>
                    <td>
                      <div className="supplier-action-row">
                        <button className="supplier-row-button" type="button" onClick={() => openDetails(item)}>
                          Detalhes
                        </button>
                        {canManage ? (
                          <button className="supplier-row-button" type="button" onClick={() => openEdit(item)}>
                            Editar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="dashboard-empty-copy">
                    {filtersActive
                      ? "Nenhuma nota encontrada para os filtros aplicados."
                      : "Nenhuma nota fiscal cadastrada."}
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
          ariaLabel="Paginacao das notas fiscais"
        />
      </section>
    </div>
  );
}
