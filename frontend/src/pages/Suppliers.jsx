import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "../services/api";
import { PERMISSIONS, hasPermission } from "../utils/access";
import { getStoredUser } from "../utils/authStorage";

const initialSupplierForm = {
  name: "",
  tradeName: "",
  cnpj: "",
  contact: "",
  email: "",
  phone: "",
  categoryId: "",
  supplierType: "CRITICO",
  status: "ATIVO",
  addressLine: "",
  addressNumber: "",
  addressComplement: "",
  district: "",
  city: "",
  state: "",
  postalCode: "",
  primaryActivity: "",
  registrationStatus: "",
  nextReview: "",
  reactivationJustification: ""
};

const initialEvaluationForm = {
  evaluationDate: new Date().toISOString().slice(0, 10),
  invoiceNumber: "",
  observations: "",
  answers: {}
};

const scoreOptions = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

const supplierTypeOptions = [
  { value: "CRITICO", label: "Critico", cadence: 30 },
  { value: "ALTO", label: "Alto risco", cadence: 45 },
  { value: "INTERMEDIARIO", label: "Intermediario", cadence: 90 },
  { value: "PADRAO", label: "Padrao", cadence: 120 },
  { value: "BASICO", label: "Basico", cadence: 180 },
  { value: "NAO_CRITICO", label: "Nao critico", cadence: 365 }
];

function normalizeCnpj(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatCnpj(value) {
  const cleaned = normalizeCnpj(value).slice(0, 14);
  return cleaned
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "-";
}

function formatCityState(supplier) {
  const parts = [supplier.city, supplier.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "-";
}

function getTypeOption(value) {
  return supplierTypeOptions.find((item) => item.value === value) || null;
}

function getTypeLabel(value) {
  return getTypeOption(value)?.label || value || "-";
}

function getCadenceDays(value) {
  return getTypeOption(value)?.cadence || 0;
}

function getStatusLabel(value) {
  return String(value || "").toUpperCase() === "BLOQUEADO" ? "Bloqueado" : "Ativo";
}

function isBlockedStatus(value) {
  return String(value || "").toUpperCase() === "BLOQUEADO";
}

function isExpiredDocumentStatus(value) {
  return String(value || "").toUpperCase() === "VENCIDO";
}

function getTrendLabel(value) {
  const mapping = {
    EM_MELHORIA: "Em melhoria",
    EM_PIORA: "Em piora",
    ESTAVEL: "Estavel"
  };
  return mapping[String(value || "").toUpperCase()] || "Estavel";
}

function getDocumentStatusLabel(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "EM_DIA") return "Em dia";
  if (normalized === "VENCIDO") return "Vencido";
  if (normalized === "PENDENTE") return "Pendente";
  return "Anexado";
}

function mapSupplierToForm(supplier) {
  return {
    name: supplier.name || "",
    tradeName: supplier.tradeName || "",
    cnpj: supplier.cnpj || "",
    contact: supplier.contact || "",
    email: supplier.email || "",
    phone: supplier.phone || "",
    categoryId: supplier.categoryId || "",
    supplierType: supplier.supplierType || "CRITICO",
    status: supplier.status || "ATIVO",
    addressLine: supplier.addressLine || "",
    addressNumber: supplier.addressNumber || "",
    addressComplement: supplier.addressComplement || "",
    district: supplier.district || "",
    city: supplier.city || "",
    state: supplier.state || "",
    postalCode: supplier.postalCode || "",
    primaryActivity: supplier.primaryActivity || "",
    registrationStatus: supplier.registrationStatus || "",
    nextReview: supplier.nextReview ? new Date(supplier.nextReview).toISOString().slice(0, 10) : "",
    reactivationJustification: supplier.reactivationJustification || ""
  };
}

function buildDocumentEntries(requirements = [], currentEntries = [], existingDocs = []) {
  const currentMap = new Map(currentEntries.map((item) => [Number(item.requiredDocumentId), item]));
  const existingMap = new Map(
    (existingDocs || [])
      .filter((item) => item.requiredDocumentId)
      .map((item) => [Number(item.requiredDocumentId), item])
  );

  return requirements.map((document) => {
    const current = currentMap.get(Number(document.id));
    const existing = existingMap.get(Number(document.id));

    return {
      requiredDocumentId: document.id,
      name: document.name,
      expiresAt:
        current?.expiresAt ||
        (existing?.expiresAt ? new Date(existing.expiresAt).toISOString().slice(0, 10) : ""),
      file: current?.file || null,
      originalName: existing?.originalName || current?.originalName || "",
      status: existing?.status || current?.status || "PENDENTE"
    };
  });
}

function buildEvaluationSummary(evaluation) {
  const answers = evaluation.answers || [];
  if (!answers.length) {
    return evaluation.observations || "-";
  }

  return answers
    .map((item) => `${item.questionText}: ${item.score}`)
    .join("; ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function Suppliers() {
  const currentUser = getStoredUser();
  const canManageSuppliers = hasPermission(currentUser, PERMISSIONS.SUPPLIERS_MANAGE);
  const canEvaluateSuppliers = hasPermission(currentUser, PERMISSIONS.SUPPLIERS_EVALUATE);
  const canExportSuppliers = hasPermission(currentUser, PERMISSIONS.SUPPLIERS_EXPORT);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm);
  const [evaluationForm, setEvaluationForm] = useState(initialEvaluationForm);
  const [documentEntries, setDocumentEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [activePanel, setActivePanel] = useState("list");
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [evaluationFile, setEvaluationFile] = useState(null);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedId) || null,
    [suppliers, selectedId]
  );

  const selectedCategoryId = useMemo(() => {
    if (activePanel === "form") {
      return Number(supplierForm.categoryId || 0);
    }

    return Number(selectedSupplier?.categoryId || 0);
  }, [activePanel, selectedSupplier?.categoryId, supplierForm.categoryId]);

  const selectedCategory = useMemo(
    () => categories.find((category) => Number(category.id) === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const supplierDocuments = useMemo(() => {
    if (!selectedSupplier) return [];

    const categoryDocuments = selectedSupplier.category?.documents || [];
    const attachedByRequirement = new Map(
      (selectedSupplier.documents || [])
        .filter((item) => item.requiredDocumentId)
        .map((item) => [Number(item.requiredDocumentId), item])
    );

    return categoryDocuments.map((requirement) => {
      const attached = attachedByRequirement.get(Number(requirement.id));
      return (
        attached || {
          id: `missing-${requirement.id}`,
          requiredDocumentId: requirement.id,
          documentName: requirement.name,
          originalName: "",
          expiresAt: null,
          status: "PENDENTE"
        }
      );
    });
  }, [selectedSupplier]);

  useEffect(() => {
    if (!selectedCategory?.documents) {
      setDocumentEntries([]);
      return;
    }

    const existingDocs =
      activePanel === "form" &&
      editingId &&
      selectedSupplier &&
      Number(selectedSupplier.categoryId) === Number(selectedCategory.id)
        ? selectedSupplier.documents || []
        : [];

    setDocumentEntries((current) =>
      buildDocumentEntries(selectedCategory.documents, current, existingDocs)
    );
  }, [activePanel, editingId, selectedCategory, selectedSupplier]);

  async function loadSuppliers(activeFilters = filters) {
    const params = {};
    if (activeFilters.search) params.search = activeFilters.search;
    if (activeFilters.status) params.status = activeFilters.status;

    const response = await api.get("/suppliers", { params });
    setSuppliers(response.data);

    if (!selectedId && response.data.length) {
      setSelectedId(response.data[0].id);
    }

    if (selectedId && !response.data.find((item) => item.id === selectedId)) {
      setSelectedId(response.data[0]?.id || null);
    }
  }

  async function loadCategories() {
    const response = await api.get("/categories");
    setCategories(response.data);
  }

  async function loadAll(activeFilters = filters) {
    await Promise.all([loadSuppliers(activeFilters), loadCategories()]);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function resetSupplierEditor() {
    setEditingId(null);
    setSupplierForm(initialSupplierForm);
    setDocumentEntries([]);
  }

  function openNewSupplier() {
    if (!canManageSuppliers) return;
    resetSupplierEditor();
    setActivePanel("form");
    setMessage("");
    setError("");
  }

  function handleSupplierFieldChange(field, value) {
    setSupplierForm((current) => ({ ...current, [field]: value }));
  }

  function handleCategoryChange(value) {
    setSupplierForm((current) => ({ ...current, categoryId: Number(value) || "" }));
  }

  async function buscarCNPJ() {
    if (!supplierForm.cnpj) return;

    try {
      setLoadingCnpj(true);
      setError("");
      const response = await api.get(`/suppliers/cnpj/${normalizeCnpj(supplierForm.cnpj)}`);
      const data = response.data;

      setSupplierForm((current) => ({
        ...current,
        cnpj: data.cnpj || current.cnpj,
        name: data.name || current.name,
        tradeName: data.trade_name || current.tradeName,
        contact: data.contact || current.contact,
        email: data.email || current.email,
        phone: data.phone || current.phone,
        addressLine: data.address_line || current.addressLine,
        addressNumber: data.address_number || current.addressNumber,
        addressComplement: data.address_complement || current.addressComplement,
        district: data.district || current.district,
        city: data.city || current.city,
        state: data.state || current.state,
        postalCode: data.postal_code || current.postalCode,
        primaryActivity: data.primary_activity || current.primaryActivity,
        registrationStatus: data.registration_status || current.registrationStatus
      }));

      setMessage("Dados do CNPJ preenchidos automaticamente.");
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel consultar o CNPJ.");
    } finally {
      setLoadingCnpj(false);
    }
  }

  async function syncSupplierDocuments(supplierId) {
    if (!documentEntries.length) return;

    const payload = documentEntries.map((item) => ({
      requiredDocumentId: item.requiredDocumentId,
      name: item.name,
      expiresAt: item.expiresAt || null
    }));

    const formData = new FormData();
    formData.append("documents", JSON.stringify(payload));

    for (const item of documentEntries) {
      if (item.file) {
        formData.append(`document_${item.requiredDocumentId}`, item.file);
      }
    }

    await api.post(`/suppliers/${supplierId}/documents`, formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
  }

  async function saveSupplier() {
    try {
      setSavingSupplier(true);
      setError("");
      setMessage("");

      const payload = {
        ...supplierForm,
        cnpj: normalizeCnpj(supplierForm.cnpj)
      };

      const response = editingId
        ? await api.put(`/suppliers/${editingId}`, payload)
        : await api.post("/suppliers", payload);

      await syncSupplierDocuments(response.data.id);
      await loadAll();
      setSelectedId(response.data.id);
      setActivePanel("list");
      setMessage(editingId ? "Fornecedor atualizado com sucesso." : "Fornecedor criado com sucesso.");
      resetSupplierEditor();
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel salvar o fornecedor.");
    } finally {
      setSavingSupplier(false);
    }
  }

  function editSupplier(supplier) {
    if (!canManageSuppliers) return;
    setEditingId(supplier.id);
    setSelectedId(supplier.id);
    setSupplierForm(mapSupplierToForm(supplier));
    setDocumentEntries(buildDocumentEntries(supplier.category?.documents || [], [], supplier.documents || []));
    setActivePanel("form");
    setMessage("");
    setError("");
  }

  function viewSupplier(supplier) {
    setSelectedId(supplier.id);
    setActivePanel("details");
    setMessage("");
    setError("");
  }

  function openEvaluation(supplier) {
    if (!canEvaluateSuppliers) return;
    setSelectedId(supplier.id);
    setActivePanel("evaluation");
    setEvaluationForm(initialEvaluationForm);
    setEvaluationFile(null);
    setMessage("");
    setError("");
  }

  async function deleteSupplier(id) {
    if (!canManageSuppliers) return;
    const confirmed = window.confirm("Deseja realmente excluir este fornecedor?");
    if (!confirmed) return;

    try {
      setError("");
      setMessage("");
      await api.delete(`/suppliers/${id}`);

      if (editingId === id) {
        resetSupplierEditor();
      }

      if (selectedId === id) {
        setSelectedId(null);
      }

      await loadAll();
      setActivePanel("list");
      setMessage("Fornecedor excluido com sucesso.");
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel excluir o fornecedor.");
    }
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

  async function triggerSecureDownload(url, fallbackName) {
    try {
      setError("");
      const response = await api.get(url, {
        responseType: "blob"
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = getDownloadFilename(
        response.headers["content-disposition"],
        fallbackName
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel baixar o arquivo.");
    }
  }

  function exportar() {
    if (!canExportSuppliers) return;
    void triggerSecureDownload("/suppliers/export/excel", "fornecedores.xlsx");
  }

  async function submitEvaluation() {
    if (!selectedSupplier) return;

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
      formData.append("invoiceNumber", evaluationForm.invoiceNumber);
      formData.append("observations", evaluationForm.observations);
      formData.append("supplierType", selectedSupplier.supplierType);
      formData.append("answers", JSON.stringify(answers));

      if (evaluationFile) {
        formData.append("evaluationDocument", evaluationFile);
      }

      const response = await api.post(`/suppliers/${selectedSupplier.id}/evaluations`, formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      setSuppliers((current) =>
        current.map((supplier) =>
          supplier.id === response.data.id ? response.data : supplier
        )
      );

      setEvaluationForm(initialEvaluationForm);
      setEvaluationFile(null);
      setActivePanel("details");
      setMessage("Avaliacao registrada com sucesso.");
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel registrar a avaliacao.");
    }
  }

  function downloadDocument(documentId) {
    if (!selectedSupplier) return;
    void triggerSecureDownload(
      `/suppliers/${selectedSupplier.id}/documents/${documentId}/download`,
      `documento-${documentId}.pdf`
    );
  }

  function downloadEvaluationDocument(evaluationId) {
    if (!selectedSupplier) return;
    void triggerSecureDownload(
      `/suppliers/${selectedSupplier.id}/evaluations/${evaluationId}/download`,
      `avaliacao-${evaluationId}.pdf`
    );
  }

  function printDossier() {
    if (!selectedSupplier) return;

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const left = 40;
    let currentY = 42;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text("Dossie resumido do fornecedor", left, currentY);

    currentY += 24;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(selectedSupplier.name || "-", left, currentY);

    currentY += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(
      `CNPJ: ${formatCnpj(selectedSupplier.cnpj)} | Status: ${getStatusLabel(selectedSupplier.status)} | Tipo: ${getTypeLabel(selectedSupplier.supplierType)} | Risco: ${Number(selectedSupplier.riskIndex || 0).toFixed(2)}`,
      left,
      currentY
    );

    currentY += 18;
    pdf.text(
      `Proxima avaliacao: ${formatDate(selectedSupplier.nextReview)}`,
      left,
      currentY
    );

    currentY += 24;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Resumo cadastral", left, currentY);

    autoTable(pdf, {
      startY: currentY + 8,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
      headStyles: { fillColor: [25, 45, 80] },
      columnStyles: { 0: { cellWidth: 150 }, 1: { cellWidth: 345 } },
      body: [
        ["Razao social", selectedSupplier.name || "-"],
        ["Nome fantasia", selectedSupplier.tradeName || "-"],
        ["Categoria", selectedSupplier.category?.name || "-"],
        ["Contato", selectedSupplier.contact || "-"],
        ["E-mail", selectedSupplier.email || "-"],
        ["Telefone", selectedSupplier.phone || "-"],
        ["Atividade principal", selectedSupplier.primaryActivity || "-"],
        ["Situacao cadastral", selectedSupplier.registrationStatus || "-"],
        ["Endereco", `${selectedSupplier.addressLine || "-"} ${selectedSupplier.addressNumber || ""}`.trim()],
        ["Complemento", selectedSupplier.addressComplement || "-"],
        ["Bairro", selectedSupplier.district || "-"],
        ["Cidade/UF", formatCityState(selectedSupplier)],
        ["CEP", selectedSupplier.postalCode || "-"]
      ]
    });

    currentY = pdf.lastAutoTable.finalY + 24;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Situacao dos documentos", left, currentY);

    autoTable(pdf, {
      startY: currentY + 8,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
      headStyles: { fillColor: [25, 45, 80] },
      body: supplierDocuments.length
        ? supplierDocuments.map((document) => [
            document.documentName || "Documento",
            document.originalName || "-",
            formatDate(document.expiresAt),
            getDocumentStatusLabel(document.status)
          ])
        : [["Nenhum documento cadastrado.", "-", "-", "-"]],
      head: [["Documento", "Arquivo", "Vencimento", "Status"]]
    });

    currentY = pdf.lastAutoTable.finalY + 24;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Historico de avaliacoes", left, currentY);

    autoTable(pdf, {
      startY: currentY + 8,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 6, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [25, 45, 80] },
      body: (selectedSupplier.evaluations || []).length
        ? selectedSupplier.evaluations.map((evaluation) => [
            formatDate(evaluation.evaluationDate),
            evaluation.invoiceNumber || "-",
            Number(evaluation.score || 0).toFixed(1),
            evaluation.classification || "-",
            buildEvaluationSummary(evaluation),
            evaluation.evaluator?.name || evaluation.evaluator?.email || "-"
          ])
        : [["Nenhuma avaliacao registrada.", "-", "-", "-", "-", "-"]],
      head: [["Data", "NF", "Nota", "Classificacao", "Resumo", "Avaliador"]]
    });

    currentY = pdf.lastAutoTable.finalY + 24;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("RNCs", left, currentY);

    autoTable(pdf, {
      startY: currentY + 8,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
      headStyles: { fillColor: [25, 45, 80] },
      body: (selectedSupplier.rncs || []).length
        ? selectedSupplier.rncs.map((item) => [
            item.description || "-",
            item.responsible || "-",
            formatDate(item.deadline),
            item.status || "-"
          ])
        : [["Nenhuma RNC gerada.", "-", "-", "-"]],
      head: [["Descricao", "Responsavel", "Prazo", "Status"]]
    });

    pdf.save(`dossie-${normalizeCnpj(selectedSupplier.cnpj) || selectedSupplier.id}.pdf`);
  }

  async function applyFilters() {
    await loadSuppliers(filters);
  }

  if (activePanel === "details" && selectedSupplier) {
    return (
      <div className="supplier-shell">
        <section className="supplier-dossier">
          <header className="supplier-dossier-header">
            <div>
              <span className="dashboard-card-eyebrow supplier-hero-kicker">Dossie do fornecedor</span>
              <h1>{selectedSupplier.name}</h1>
              <p>
                {formatCnpj(selectedSupplier.cnpj)} | {getTypeLabel(selectedSupplier.supplierType).toLowerCase()} | risco{" "}
                {Number(selectedSupplier.riskIndex || 0).toFixed(2)} | tendencia {getTrendLabel(selectedSupplier.trend)}
              </p>
            </div>

            <div className="supplier-hero-actions">
              <button className="supplier-toolbar-button supplier-toolbar-button-muted" type="button" onClick={() => setActivePanel("list")}>
                Voltar
              </button>
              {canEvaluateSuppliers ? (
                <button className="supplier-toolbar-button supplier-toolbar-button-primary" type="button" onClick={() => openEvaluation(selectedSupplier)}>
                  Avaliar
                </button>
              ) : null}
              <button className="supplier-toolbar-button supplier-toolbar-button-muted" type="button" onClick={printDossier}>
                PDF
              </button>
              {canManageSuppliers ? (
                <button className="supplier-toolbar-button supplier-toolbar-button-muted" type="button" onClick={() => editSupplier(selectedSupplier)}>
                  Editar
                </button>
              ) : null}
              {canManageSuppliers ? (
                <button
                  className="supplier-toolbar-button supplier-row-button-danger"
                  type="button"
                  onClick={() => deleteSupplier(selectedSupplier.id)}
                >
                  Excluir
                </button>
              ) : null}
            </div>
          </header>

          <section className="supplier-dossier-metrics">
            <article className="supplier-dossier-metric">
              <span>Status</span>
              <strong className={isBlockedStatus(selectedSupplier.status) ? "supplier-status-emphasis supplier-status-emphasis-blocked" : ""}>
                {getStatusLabel(selectedSupplier.status)}
              </strong>
            </article>
            <article className="supplier-dossier-metric">
              <span>Cadencia</span>
              <strong>{getCadenceDays(selectedSupplier.supplierType)} dias</strong>
            </article>
            <article className="supplier-dossier-metric">
              <span>Proxima avaliacao</span>
              <strong>{formatDate(selectedSupplier.nextReview)}</strong>
            </article>
            <article className="supplier-dossier-metric">
              <span>Documentos em dia</span>
              <strong>
                {selectedSupplier.documentsSummary?.valid || 0}/{selectedSupplier.documentsSummary?.required || 0}
              </strong>
              <small>
                <span className="supplier-status-emphasis supplier-status-emphasis-expired">
                  {selectedSupplier.documentsSummary?.expired || 0} vencido(s)
                </span>
                {", "}
                {selectedSupplier.documentsSummary?.missing || 0} pendente(s)
              </small>
            </article>
          </section>

          <section className="supplier-dossier-card">
            <h2>Dados cadastrais</h2>
            <div className="supplier-dossier-data-table">
              <div><span>Razao social</span><strong>{selectedSupplier.name || "-"}</strong></div>
              <div><span>Nome fantasia</span><strong>{selectedSupplier.tradeName || "-"}</strong></div>
              <div><span>Categoria</span><strong>{selectedSupplier.category?.name || "-"}</strong></div>
              <div><span>Perguntas da categoria</span><strong>{selectedSupplier.category?.questions?.length || 0}</strong></div>
              <div><span>Documentos exigidos</span><strong>{selectedSupplier.category?.documents?.length || 0}</strong></div>
              <div><span>Contato</span><strong>{selectedSupplier.contact || "-"}</strong></div>
              <div><span>E-mail</span><strong>{selectedSupplier.email || "-"}</strong></div>
              <div><span>Telefone</span><strong>{selectedSupplier.phone || "-"}</strong></div>
              <div><span>Atividade principal</span><strong>{selectedSupplier.primaryActivity || "-"}</strong></div>
              <div><span>Situacao cadastral</span><strong>{selectedSupplier.registrationStatus || "-"}</strong></div>
              <div><span>Endereco</span><strong>{`${selectedSupplier.addressLine || "-"} ${selectedSupplier.addressNumber || ""}`.trim()}</strong></div>
              <div><span>Complemento</span><strong>{selectedSupplier.addressComplement || "-"}</strong></div>
              <div><span>Bairro</span><strong>{selectedSupplier.district || "-"}</strong></div>
              <div><span>Cidade/UF</span><strong>{formatCityState(selectedSupplier)}</strong></div>
              <div><span>CEP</span><strong>{selectedSupplier.postalCode || "-"}</strong></div>
            </div>
          </section>

          <section className="supplier-dossier-card">
            <h2>Situacao dos documentos</h2>
            <div className="supplier-dossier-doc-list">
              {supplierDocuments.length ? (
                supplierDocuments.map((document) => (
                  <article
                    key={document.id}
                    className={`supplier-dossier-doc-card supplier-dossier-doc-${String(document.status || "").toLowerCase()}`}
                  >
                    <div>
                      <strong className={isExpiredDocumentStatus(document.status) ? "supplier-status-emphasis supplier-status-emphasis-expired" : ""}>
                        {document.documentName || "Documento"}
                      </strong>
                      <p>Arquivo: {document.originalName || "-"}</p>
                      <p>Vencimento: {formatDate(document.expiresAt)}</p>
                      {document.id && String(document.id).startsWith("missing-") === false && document.originalName ? (
                        <button
                          type="button"
                          className="supplier-doc-download"
                          onClick={() => downloadDocument(document.id)}
                        >
                          Baixar arquivo
                        </button>
                      ) : null}
                    </div>
                    <span className={`supplier-dossier-doc-badge supplier-dossier-doc-badge-${String(document.status || "").toLowerCase()}`}>
                      {getDocumentStatusLabel(document.status)}
                    </span>
                  </article>
                ))
              ) : (
                <p className="dashboard-empty-copy">Nenhum documento cadastrado para este fornecedor.</p>
              )}
            </div>
          </section>

          <section className="supplier-dossier-card">
            <h2>Historico de avaliacoes</h2>
            <div className="supplier-dossier-history-bars">
              {(selectedSupplier.evaluations || []).slice(0, 2).map((evaluation) => (
                <div key={evaluation.id} className="supplier-dossier-history-bar-row">
                  <span>{formatDate(evaluation.evaluationDate)}</span>
                  <div className="supplier-dossier-history-track">
                    <div
                      className="supplier-dossier-history-fill"
                      style={{ width: `${Math.max(0, Math.min(100, Number(evaluation.score || 0)))}%` }}
                    />
                  </div>
                  <strong>{Number(evaluation.score || 0).toFixed(1)}</strong>
                </div>
              ))}
            </div>

            <div className="supplier-dossier-history-table-wrap">
              <table className="supplier-dossier-history-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>NF</th>
                    <th>Nota</th>
                    <th>Classificacao</th>
                    <th>Questionario</th>
                    <th>Avaliador</th>
                    <th>Documento</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedSupplier.evaluations || []).length ? (
                    selectedSupplier.evaluations.map((evaluation) => (
                      <tr key={evaluation.id}>
                        <td>{formatDate(evaluation.evaluationDate)}</td>
                        <td>{evaluation.invoiceNumber || "-"}</td>
                        <td>{Number(evaluation.score || 0).toFixed(1)}</td>
                        <td>{evaluation.classification || "-"}</td>
                        <td>{buildEvaluationSummary(evaluation)}</td>
                        <td>{evaluation.evaluator?.name || evaluation.evaluator?.email || "-"}</td>
                        <td>
                          {evaluation.hasAttachment ? (
                            <button
                              type="button"
                              className="supplier-doc-download"
                              onClick={() => downloadEvaluationDocument(evaluation.id)}
                            >
                              {evaluation.attachmentOriginalName || "Baixar PDF"}
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="dashboard-empty-copy">
                        Nenhuma avaliacao registrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="supplier-dossier-card">
            <h2>RNCs</h2>
            <div className="supplier-dossier-history-table-wrap">
              <table className="supplier-dossier-history-table">
                <thead>
                  <tr>
                    <th>Descricao</th>
                    <th>Responsavel</th>
                    <th>Prazo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedSupplier.rncs || []).length ? (
                    selectedSupplier.rncs.map((item) => (
                      <tr key={item.id}>
                        <td>{item.description || "-"}</td>
                        <td>{item.responsible || "-"}</td>
                        <td>{formatDate(item.deadline)}</td>
                        <td>{item.status || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="dashboard-empty-copy">
                        Nenhuma RNC gerada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
      </div>
    );
  }

  if (activePanel === "form") {
    return (
      <div className="supplier-shell">
        <section className="supplier-form-panel">
          <div className="supplier-form-heading">
            <div>
              <span className="dashboard-card-eyebrow supplier-hero-kicker">Cadastro mestre</span>
              <h2>{editingId ? "Editar fornecedor" : "Novo fornecedor"}</h2>
              <p>
                Preencha o CNPJ e use a consulta para completar automaticamente os dados cadastrais da empresa.
                Os documentos obrigatorios mudam conforme a categoria escolhida.
              </p>
            </div>
            <div className="supplier-hero-actions supplier-hero-actions-right">
              <button className="supplier-toolbar-button supplier-toolbar-button-muted" type="button" onClick={() => setActivePanel("list")}>
                Voltar
              </button>
            </div>
          </div>

          <div className="supplier-form-grid">
            <div className="supplier-form-cnpj-row">
              <div className="supplier-form-field">
                <label>CNPJ</label>
                <input
                  className="supplier-form-input"
                  placeholder="00.000.000/0000-00"
                  value={formatCnpj(supplierForm.cnpj)}
                  onChange={(event) => handleSupplierFieldChange("cnpj", event.target.value)}
                />
              </div>

              <button className="supplier-filter-button" type="button" onClick={buscarCNPJ} disabled={loadingCnpj}>
                {loadingCnpj ? "Buscando..." : "Buscar CNPJ"}
              </button>

              <div className="supplier-form-field">
                <label>Categoria</label>
                <select
                  className="supplier-form-input"
                  value={supplierForm.categoryId}
                  onChange={(event) => handleCategoryChange(event.target.value)}
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="supplier-form-field">
                <label>Tipo</label>
                <select
                  className="supplier-form-input"
                  value={supplierForm.supplierType}
                  onChange={(event) => handleSupplierFieldChange("supplierType", event.target.value)}
                >
                  {supplierTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="supplier-helper-text">
              Categoria do fornecedor ao lado do CNPJ. Cadastre ou edite categorias no menu `Categorias`. Fonte da
              consulta: BrasilAPI.
            </p>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Razao social</label>
              <input className="supplier-form-input" value={supplierForm.name} onChange={(event) => handleSupplierFieldChange("name", event.target.value)} />
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Nome fantasia</label>
              <input className="supplier-form-input" value={supplierForm.tradeName} onChange={(event) => handleSupplierFieldChange("tradeName", event.target.value)} />
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Contato principal</label>
                <input className="supplier-form-input" value={supplierForm.contact} onChange={(event) => handleSupplierFieldChange("contact", event.target.value)} />
              </div>
              <div className="supplier-form-field">
                <label>E-mail comercial</label>
                <input className="supplier-form-input" value={supplierForm.email} onChange={(event) => handleSupplierFieldChange("email", event.target.value)} />
              </div>
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Telefone</label>
                <input className="supplier-form-input" value={supplierForm.phone} onChange={(event) => handleSupplierFieldChange("phone", event.target.value)} />
              </div>
              <div className="supplier-form-field">
                <label>Status</label>
                <select className="supplier-form-input" value={supplierForm.status} onChange={(event) => handleSupplierFieldChange("status", event.target.value)}>
                  <option value="ATIVO">Ativo</option>
                  <option value="BLOQUEADO">Bloqueado</option>
                </select>
              </div>
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Logradouro</label>
              <input className="supplier-form-input" value={supplierForm.addressLine} onChange={(event) => handleSupplierFieldChange("addressLine", event.target.value)} />
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Numero</label>
                <input className="supplier-form-input" value={supplierForm.addressNumber} onChange={(event) => handleSupplierFieldChange("addressNumber", event.target.value)} />
              </div>
              <div className="supplier-form-field">
                <label>Complemento</label>
                <input className="supplier-form-input" value={supplierForm.addressComplement} onChange={(event) => handleSupplierFieldChange("addressComplement", event.target.value)} />
              </div>
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Bairro</label>
                <input className="supplier-form-input" value={supplierForm.district} onChange={(event) => handleSupplierFieldChange("district", event.target.value)} />
              </div>
              <div className="supplier-form-field">
                <label>Cidade</label>
                <input className="supplier-form-input" value={supplierForm.city} onChange={(event) => handleSupplierFieldChange("city", event.target.value)} />
              </div>
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>UF</label>
                <input className="supplier-form-input" value={supplierForm.state} onChange={(event) => handleSupplierFieldChange("state", event.target.value)} />
              </div>
              <div className="supplier-form-field">
                <label>CEP</label>
                <input className="supplier-form-input" value={supplierForm.postalCode} onChange={(event) => handleSupplierFieldChange("postalCode", event.target.value)} />
              </div>
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Atividade principal</label>
              <input className="supplier-form-input" value={supplierForm.primaryActivity} onChange={(event) => handleSupplierFieldChange("primaryActivity", event.target.value)} />
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Situacao cadastral</label>
                <input className="supplier-form-input" value={supplierForm.registrationStatus} onChange={(event) => handleSupplierFieldChange("registrationStatus", event.target.value)} />
              </div>
              <div className="supplier-form-field">
                <label>Proxima avaliacao</label>
                <input className="supplier-form-input" type="date" value={supplierForm.nextReview} onChange={(event) => handleSupplierFieldChange("nextReview", event.target.value)} />
              </div>
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Documentacao obrigatoria</label>
              <div className="supplier-document-list">
                {documentEntries.length ? (
                  documentEntries.map((entry) => (
                    <div key={entry.requiredDocumentId} className="supplier-document-card">
                      <div className="supplier-document-header">
                        <strong>{entry.name}</strong>
                        <span>{entry.originalName || entry.status}</span>
                      </div>
                      <div className="supplier-document-fields">
                        <input
                          className="supplier-form-input"
                          type="file"
                          accept=".pdf"
                          onChange={(event) =>
                            setDocumentEntries((current) =>
                              current.map((item) =>
                                item.requiredDocumentId === entry.requiredDocumentId
                                  ? {
                                      ...item,
                                      file: event.target.files?.[0] || null,
                                      originalName: event.target.files?.[0]?.name || item.originalName
                                    }
                                  : item
                              )
                            )
                          }
                        />
                        <input
                          className="supplier-form-input"
                          type="date"
                          value={entry.expiresAt}
                          onChange={(event) =>
                            setDocumentEntries((current) =>
                              current.map((item) =>
                                item.requiredDocumentId === entry.requiredDocumentId
                                  ? { ...item, expiresAt: event.target.value }
                                  : item
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="supplier-helper-text">Esta categoria nao possui documentos obrigatorios cadastrados.</p>
                )}
              </div>
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Justificativa de reativacao</label>
              <textarea className="supplier-form-textarea" value={supplierForm.reactivationJustification} onChange={(event) => handleSupplierFieldChange("reactivationJustification", event.target.value)} />
            </div>

            <div className="supplier-form-actions">
              <button className="supplier-save-button" type="button" onClick={saveSupplier} disabled={savingSupplier}>
                {savingSupplier ? "Salvando..." : editingId ? "Salvar alteracoes" : "Salvar fornecedor"}
              </button>
              <button className="supplier-cancel-button" type="button" onClick={resetSupplierEditor}>
                Limpar formulario
              </button>
            </div>
          </div>
        </section>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
      </div>
    );
  }

  if (activePanel === "evaluation" && selectedSupplier) {
    return (
      <div className="supplier-shell">
        <section className="supplier-form-panel">
          <div className="supplier-form-heading">
            <div>
              <span className="dashboard-card-eyebrow supplier-hero-kicker">Avaliacao</span>
              <h2>Avaliar fornecedor</h2>
              <p>A pontuacao segue as perguntas vinculadas a categoria de {selectedSupplier.name}.</p>
            </div>
            <div className="supplier-hero-actions supplier-hero-actions-right">
              <button className="supplier-toolbar-button supplier-toolbar-button-muted" type="button" onClick={() => setActivePanel("details")}>
                Voltar
              </button>
            </div>
          </div>

          <div className="supplier-form-grid">
            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Data da avaliacao</label>
                <input
                  className="supplier-form-input"
                  type="date"
                  value={evaluationForm.evaluationDate}
                  onChange={(event) => setEvaluationForm((current) => ({ ...current, evaluationDate: event.target.value }))}
                />
              </div>
              <div className="supplier-form-field">
                <label>Numero da nota fiscal</label>
                <input
                  className="supplier-form-input"
                  value={evaluationForm.invoiceNumber}
                  onChange={(event) => setEvaluationForm((current) => ({ ...current, invoiceNumber: event.target.value }))}
                />
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
              <p className="dashboard-empty-copy">A categoria deste fornecedor ainda nao possui perguntas cadastradas.</p>
            ) : null}

              <div className="supplier-form-field supplier-form-field-full">
                <label>Observacoes</label>
                <textarea className="supplier-form-textarea" value={evaluationForm.observations} onChange={(event) => setEvaluationForm((current) => ({ ...current, observations: event.target.value }))} />
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
                    <div className="info-strip">
                      <strong>Uso</strong>
                      <span>Anexe o PDF da avaliacao recebida para manter o historico consultavel no fornecedor.</span>
                    </div>
                  </div>
                </div>
              </div>

            <div className="supplier-form-actions">
              <button className="supplier-save-button" type="button" onClick={submitEvaluation} disabled={!selectedCategory?.questions?.length}>
                Registrar avaliacao
              </button>
            </div>
          </div>
        </section>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="supplier-shell">
      <header className="supplier-hero">
        <div>
          <span className="dashboard-card-eyebrow supplier-hero-kicker">Cadastro e rastreabilidade</span>
          <h1>Fornecedores</h1>
          <p>Consulte, filtre e acompanhe o status da base homologada.</p>
        </div>

        <div className="supplier-hero-actions">
          {canExportSuppliers ? (
            <button className="supplier-toolbar-button supplier-toolbar-button-muted" type="button" onClick={exportar}>
              Exportar Excel
            </button>
          ) : null}
          {canManageSuppliers ? (
            <button className="supplier-toolbar-button supplier-toolbar-button-primary" type="button" onClick={openNewSupplier}>
              Novo fornecedor
            </button>
          ) : null}
        </div>
      </header>

      <section className="supplier-list-card">
        <div className="supplier-filter-row">
          <input
            className="supplier-filter-input"
            placeholder="Buscar fornecedor"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          />
          <select
            className="supplier-filter-select"
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          >
            <option value="">Todos os status</option>
            <option value="ATIVO">Ativo</option>
            <option value="BLOQUEADO">Bloqueado</option>
          </select>
          <button className="supplier-filter-button" type="button" onClick={applyFilters}>
            Filtrar
          </button>
        </div>

        <div className="supplier-table-wrap">
          <table className="supplier-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CNPJ</th>
                <th>Categoria</th>
                <th>Tipo</th>
                <th>Cidade/UF</th>
                <th>Status</th>
                <th>Proxima avaliacao</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length ? (
                suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <strong>{supplier.name}</strong>
                      <span>{supplier.tradeName || "-"}</span>
                    </td>
                    <td>{formatCnpj(supplier.cnpj)}</td>
                    <td>
                      <span className="supplier-pill">{supplier.category?.name || "Sem categoria"}</span>
                    </td>
                    <td>
                      <span className="supplier-pill">{getTypeLabel(supplier.supplierType)}</span>
                    </td>
                    <td>{formatCityState(supplier)}</td>
                    <td>
                      <span className={isBlockedStatus(supplier.status) ? "supplier-status-badge supplier-status-badge-blocked" : "supplier-status-badge"}>
                        {getStatusLabel(supplier.status)}
                      </span>
                    </td>
                    <td>{formatDate(supplier.nextReview)}</td>
                    <td>
                      <div className="supplier-action-row">
                        <button className="supplier-row-button" type="button" onClick={() => viewSupplier(supplier)}>
                          Ver
                        </button>
                        {canEvaluateSuppliers ? (
                          <button className="supplier-row-button" type="button" onClick={() => openEvaluation(supplier)}>
                            Avaliar
                          </button>
                        ) : null}
                        {canManageSuppliers ? (
                          <button className="supplier-row-button" type="button" onClick={() => editSupplier(supplier)}>
                            Editar
                          </button>
                        ) : null}
                        {canManageSuppliers ? (
                          <button className="supplier-row-button supplier-row-button-danger" type="button" onClick={() => deleteSupplier(supplier.id)}>
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="dashboard-empty-copy">
                    Nenhum fornecedor encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="success-text">{message}</p> : null}
    </div>
  );
}
