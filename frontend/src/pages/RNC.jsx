import { useEffect, useState } from "react";
import { api } from "../services/api";
import { PERMISSIONS, hasPermission } from "../utils/access";
import { getStoredUser } from "../utils/authStorage";

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
  const currentUser = getStoredUser();
  const canManageRnc = hasPermission(currentUser, PERMISSIONS.RNC_MANAGE);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await api.get("/rnc");
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
      await api.put(`/rnc/${selectedItem.id}`, form);
      await load();
      setMessage(isResolvedStatus(selectedItem.status) ? "RNC atualizada com sucesso." : "Tratativa salva com sucesso.");
      setSelectedItem(null);
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel atualizar a RNC.");
    }
  }

  useEffect(() => {
    load();
  }, []);

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
            <div className="supplier-form-field supplier-form-field-full">
              <label>Descricao</label>
              <textarea
                className="supplier-form-textarea"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Causa raiz</label>
              <textarea
                className="supplier-form-textarea"
                value={form.cause}
                onChange={(event) => setForm({ ...form, cause: event.target.value })}
              />
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Acao corretiva</label>
              <textarea
                className="supplier-form-textarea"
                value={form.correctiveAction}
                onChange={(event) => setForm({ ...form, correctiveAction: event.target.value })}
              />
            </div>

            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Responsavel</label>
                <input
                  className="supplier-form-input"
                  value={form.responsible}
                  onChange={(event) => setForm({ ...form, responsible: event.target.value })}
                />
              </div>
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
                {items.length ? (
                  items.map((item) => (
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
                      Nenhuma RNC encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
