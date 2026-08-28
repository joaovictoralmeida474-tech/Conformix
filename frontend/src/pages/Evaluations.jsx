import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStoredUser } from "../hooks/useStoredUser";
import { api } from "../services/api";
import { cachedGet } from "../services/cachedApi";
import { PERMISSIONS, hasPermission } from "../utils/access";

const initialEvaluationForm = {
  evaluationDate: new Date().toISOString().slice(0, 10),
  serviceInvoiceId: "",
  observations: "",
  answers: {}
};

const invoiceStatusLabels = {
  EM_ANALISE: "Em analise",
  APROVADA: "Aprovada",
  COM_PENDENCIA: "Com pendencia",
  CANCELADA: "Cancelada"
};

const scoreOptions = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

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

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "-";
}

function getStatusLabel(value) {
  return String(value || "").toUpperCase() === "BLOQUEADO" ? "Bloqueado" : "Ativo";
}

function formatInvoiceStatus(value) {
  return invoiceStatusLabels[String(value || "").toUpperCase()] || value || "-";
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatInvoiceLabel(invoice) {
  const number = [invoice.number, invoice.series ? `Serie ${invoice.series}` : ""].filter(Boolean).join(" / ");
  const parts = [
    number ? `NF ${number}` : "NF sem numero",
    formatDate(invoice.issueDate),
    formatMoney(invoice.netAmount),
    formatInvoiceStatus(invoice.status)
  ];
  return parts.join(" · ");
}

function resolveInvoiceNumber(invoice) {
  if (!invoice) return "";
  const number = String(invoice.number || "").trim();
  if (!number) return "";
  return invoice.series ? `${number}/${invoice.series}` : number;
}

export default function Evaluations() {
  const currentUser = useStoredUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const canEvaluate = hasPermission(currentUser, PERMISSIONS.SUPPLIERS_EVALUATE);

  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [supplierDetails, setSupplierDetails] = useState({});
  const [search, setSearch] = useState("");
  const [evaluationForm, setEvaluationForm] = useState(initialEvaluationForm);
  const [evaluationFile, setEvaluationFile] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSupplier, setLoadingSupplier] = useState(false);

  const supplierIdParam = Number(searchParams.get("supplierId") || 0);
  const isFormPanel = supplierIdParam > 0;

  const selectedSupplier = useMemo(() => {
    if (!supplierIdParam) return null;
    return (
      supplierDetails[supplierIdParam] ||
      suppliers.find((item) => Number(item.id) === supplierIdParam) ||
      null
    );
  }, [supplierIdParam, supplierDetails, suppliers]);

  const selectedCategory = useMemo(() => {
    if (!selectedSupplier) return null;
    if (selectedSupplier.category?.questions) return selectedSupplier.category;
    return categories.find((item) => Number(item.id) === Number(selectedSupplier.categoryId)) || null;
  }, [selectedSupplier, categories]);

  const supplierInvoices = useMemo(() => {
    const items = selectedSupplier?.serviceInvoices || [];
    return [...items].sort((left, right) => {
      const leftTime = new Date(left.issueDate || left.createdAt || 0).getTime();
      const rightTime = new Date(right.issueDate || right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
  }, [selectedSupplier]);

  const selectedInvoice = useMemo(() => {
    if (!evaluationForm.serviceInvoiceId) return null;
    return supplierInvoices.find((item) => String(item.id) === String(evaluationForm.serviceInvoiceId)) || null;
  }, [evaluationForm.serviceInvoiceId, supplierInvoices]);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter((item) => {
      const haystack = `${item.name || ""} ${item.tradeName || ""} ${item.cnpj || ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [suppliers, search]);

  async function loadBase() {
    try {
      setLoading(true);
      const [suppliersResponse, categoriesResponse] = await Promise.all([
        cachedGet("/suppliers", {}, { force: true }),
        cachedGet("/categories", {}, { force: false })
      ]);
      setSuppliers(Array.isArray(suppliersResponse.data) ? suppliersResponse.data : []);
      setCategories(Array.isArray(categoriesResponse.data) ? categoriesResponse.data : []);
    } catch {
      setError("Nao foi possivel carregar os fornecedores para avaliacao.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSupplierDetails(id) {
    try {
      setLoadingSupplier(true);
      const { data } = await cachedGet(`/suppliers/${id}`, {}, { force: true });
      setSupplierDetails((current) => ({ ...current, [id]: data }));
      return data;
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel carregar o fornecedor.");
      return null;
    } finally {
      setLoadingSupplier(false);
    }
  }

  function openEvaluation(supplier) {
    if (!canEvaluate) return;
    setEvaluationForm(initialEvaluationForm);
    setEvaluationFile(null);
    setError("");
    setMessage("");
    setSearchParams({ supplierId: String(supplier.id) });
    void loadSupplierDetails(supplier.id);
  }

  function backToList() {
    setEvaluationForm(initialEvaluationForm);
    setEvaluationFile(null);
    setError("");
    setSearchParams({});
  }

  async function submitEvaluation() {
    if (!selectedSupplier || !canEvaluate) return;

    if (!supplierInvoices.length) {
      setError("Este fornecedor nao possui notas fiscais vinculadas. Cadastre a NF no modulo NFS antes de avaliar.");
      return;
    }

    if (!selectedInvoice) {
      setError("Selecione a nota fiscal que sera avaliada.");
      return;
    }

    try {
      setError("");
      setMessage("");
      const answers = (selectedCategory?.questions || []).map((question) => ({
        questionId: question.id,
        questionText: question.prompt,
        score: Number(evaluationForm.answers[question.id] || 0)
      }));

      const formData = new FormData();
      formData.append("evaluationDate", evaluationForm.evaluationDate);
      formData.append("invoiceNumber", resolveInvoiceNumber(selectedInvoice));
      formData.append("observations", evaluationForm.observations);
      formData.append("supplierType", selectedSupplier.supplierType);
      formData.append("answers", JSON.stringify(answers));

      if (evaluationFile) {
        formData.append("evaluationDocument", evaluationFile);
      }

      await api.post(`/suppliers/${selectedSupplier.id}/evaluations`, formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      setMessage("Avaliacao registrada com sucesso.");
      setEvaluationForm(initialEvaluationForm);
      setEvaluationFile(null);
      await loadSupplierDetails(selectedSupplier.id);
      await loadBase();
      setSearchParams({});
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel registrar a avaliacao.");
    }
  }

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    if (!supplierIdParam || !canEvaluate) return;
    void loadSupplierDetails(supplierIdParam);
  }, [supplierIdParam, canEvaluate]);

  if (!canEvaluate) {
    return (
      <div className="supplier-shell">
        <header className="supplier-hero">
          <div>
            <span className="dashboard-card-eyebrow supplier-hero-kicker">Avaliacao de fornecedores</span>
            <h1>Avaliacoes</h1>
            <p>Seu perfil nao possui permissao para avaliar fornecedores.</p>
          </div>
        </header>
      </div>
    );
  }

  if (isFormPanel && selectedSupplier) {
    return (
      <div className="supplier-shell">
        <section className="supplier-form-panel">
          <div className="supplier-form-heading">
            <div>
              <span className="dashboard-card-eyebrow supplier-hero-kicker">Avaliacao</span>
              <h2>Avaliar fornecedor</h2>
              <p>
                {selectedSupplier.name} · {formatCnpj(selectedSupplier.cnpj)}
              </p>
            </div>
            <div className="supplier-hero-actions supplier-hero-actions-right">
              <button className="supplier-toolbar-button supplier-toolbar-button-muted" type="button" onClick={backToList}>
                Voltar
              </button>
            </div>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}

          <div className="supplier-form-grid">
            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Data da avaliacao</label>
                <input
                  className="supplier-form-input"
                  type="date"
                  value={evaluationForm.evaluationDate}
                  onChange={(event) =>
                    setEvaluationForm((current) => ({ ...current, evaluationDate: event.target.value }))
                  }
                />
              </div>
              <div className="supplier-form-field">
                <label>Nota fiscal vinculada</label>
                <select
                  className="supplier-form-input"
                  value={evaluationForm.serviceInvoiceId}
                  disabled={loadingSupplier || !supplierInvoices.length}
                  onChange={(event) =>
                    setEvaluationForm((current) => ({ ...current, serviceInvoiceId: event.target.value }))
                  }
                >
                  <option value="">
                    {loadingSupplier
                      ? "Carregando notas fiscais..."
                      : supplierInvoices.length
                        ? "Selecione a nota fiscal"
                        : "Nenhuma NF vinculada a este fornecedor"}
                  </option>
                  {supplierInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {formatInvoiceLabel(invoice)}
                    </option>
                  ))}
                </select>
                {!loadingSupplier && !supplierInvoices.length ? (
                  <p className="dashboard-empty-copy" style={{ marginTop: "0.55rem" }}>
                    Cadastre a nota fiscal no modulo NFS vinculando ao CNPJ deste fornecedor.
                  </p>
                ) : null}
                {selectedInvoice ? (
                  <p className="dashboard-empty-copy" style={{ marginTop: "0.55rem" }}>
                    {selectedInvoice.serviceDescription || "Servico nao informado"} · {formatMoney(selectedInvoice.netAmount)}
                  </p>
                ) : null}
              </div>
            </div>

            {(selectedCategory?.questions || []).map((question) => (
              <div key={question.id} className="supplier-form-field supplier-form-field-full">
                <label>{question.prompt}</label>
                <select
                  className="supplier-form-input"
                  value={evaluationForm.answers[question.id] || ""}
                  onChange={(event) =>
                    setEvaluationForm((current) => ({
                      ...current,
                      answers: {
                        ...current.answers,
                        [question.id]: event.target.value
                      }
                    }))
                  }
                >
                  <option value="">Selecione a nota</option>
                  {scoreOptions.map((score) => (
                    <option key={score} value={score}>
                      {score}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {!selectedCategory?.questions?.length ? (
              <p className="dashboard-empty-copy">
                A categoria deste fornecedor ainda nao possui perguntas cadastradas.
              </p>
            ) : null}

            <div className="supplier-form-field supplier-form-field-full">
              <label>Observacoes</label>
              <textarea
                className="supplier-form-textarea"
                value={evaluationForm.observations}
                onChange={(event) =>
                  setEvaluationForm((current) => ({ ...current, observations: event.target.value }))
                }
              />
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Anexo da avaliacao em PDF</label>
              <div className="supplier-document-card">
                <div className="supplier-document-header">
                  <strong>Documento recebido para alimentar a avaliacao</strong>
                  <span>{evaluationFile?.name || "Nenhum arquivo selecionado"}</span>
                </div>
                <div className="supplier-document-fields">
                  <input
                    className="supplier-form-input"
                    type="file"
                    accept=".pdf"
                    onChange={(event) => setEvaluationFile(event.target.files?.[0] || null)}
                  />
                </div>
              </div>
            </div>

            <div className="supplier-form-actions">
              <button
                className="supplier-save-button"
                type="button"
                onClick={submitEvaluation}
                disabled={!selectedCategory?.questions?.length || loadingSupplier || !supplierInvoices.length}
              >
                Registrar avaliacao
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="supplier-shell">
      <header className="supplier-hero">
        <div>
          <span className="dashboard-card-eyebrow supplier-hero-kicker">Avaliacao de fornecedores</span>
          <h1>Avaliacoes</h1>
          <p>Selecione um fornecedor cadastrado para registrar a avaliacao.</p>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="success-text">{message}</p> : null}

      <section className="supplier-list-card">
        <div className="supplier-filter-row">
          <input
            className="supplier-filter-input"
            placeholder="Buscar fornecedor por nome ou CNPJ"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="supplier-table-wrap">
          <table className="supplier-table">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>CNPJ</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Proxima avaliacao</th>
                <th>Ultima nota</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length ? (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <strong>{supplier.name}</strong>
                      <span>{supplier.tradeName || "-"}</span>
                    </td>
                    <td>{formatCnpj(supplier.cnpj)}</td>
                    <td>
                      <span className="supplier-pill">{supplier.category?.name || "Sem categoria"}</span>
                    </td>
                    <td>{getStatusLabel(supplier.status)}</td>
                    <td>{formatDate(supplier.nextReview)}</td>
                    <td>{Number(supplier.score || 0).toFixed(1)}</td>
                    <td>
                      <div className="supplier-action-row">
                        <button className="supplier-row-button" type="button" onClick={() => openEvaluation(supplier)}>
                          Avaliar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="dashboard-empty-copy">
                    {loading ? "Carregando fornecedores..." : "Nenhum fornecedor encontrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
