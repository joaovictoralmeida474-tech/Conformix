import { useEffect, useState } from "react";
import { api } from "../services/api";

const initialForm = {
  name: "",
  slug: "",
  description: "",
  questions: [],
  documents: [],
  active: true
};

function parseLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyLines(values = []) {
  return (values || []).join("\n");
}

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [questionText, setQuestionText] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [activePanel, setActivePanel] = useState("list");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await api.get("/categories");
    setCategories(response.data);
  }

  async function saveCategory() {
    try {
      setError("");
      setMessage("");

      const payload = {
        ...form,
        questions: parseLines(questionText),
        documents: parseLines(documentText)
      };

      if (editingId) {
        await api.put(`/categories/${editingId}`, payload);
        setMessage("Categoria atualizada com sucesso.");
      } else {
        await api.post("/categories", payload);
        setMessage("Categoria criada com sucesso.");
      }

      await load();
      setForm(initialForm);
      setQuestionText("");
      setDocumentText("");
      setEditingId(null);
      setActivePanel("list");
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel salvar a categoria.");
    }
  }

  function editCategory(category) {
    setEditingId(category.id);
    setForm({
      name: category.name || "",
      slug: category.slug || "",
      description: category.description || "",
      questions: (category.questions || []).map((item) => item.prompt),
      documents: (category.documents || []).map((item) => item.name),
      active: category.active !== false
    });
    setQuestionText(stringifyLines((category.questions || []).map((item) => item.prompt)));
    setDocumentText(stringifyLines((category.documents || []).map((item) => item.name)));
    setActivePanel("form");
    setError("");
    setMessage("");
  }

  function openNewCategory() {
    setEditingId(null);
    setForm(initialForm);
    setQuestionText("");
    setDocumentText("");
    setActivePanel("form");
    setError("");
    setMessage("");
  }

  async function deleteCategory(id) {
    try {
      setError("");
      setMessage("");
      await api.delete(`/categories/${id}`);

      if (editingId === id) {
        setEditingId(null);
        setForm(initialForm);
        setQuestionText("");
        setDocumentText("");
        setActivePanel("list");
      }

      await load();
      setMessage("Categoria excluida com sucesso.");
    } catch (err) {
      setError(err.response?.data?.error || "Nao foi possivel excluir a categoria.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (activePanel === "form") {
    return (
      <div className="category-shell">
        <section className="category-form-panel">
          <div className="supplier-form-heading">
            <div>
              <span className="dashboard-card-eyebrow supplier-hero-kicker">Configuracao de categoria</span>
              <h2>{editingId ? "Editar categoria" : "Nova categoria"}</h2>
              <p>
                Cadastre a categoria, as perguntas da avaliacao e os documentos obrigatorios exigidos para os fornecedores dessa categoria.
              </p>
            </div>
            <div className="supplier-hero-actions supplier-hero-actions-right">
              <button
                className="supplier-toolbar-button supplier-toolbar-button-muted"
                type="button"
                onClick={() => setActivePanel("list")}
              >
                Voltar
              </button>
            </div>
          </div>

          <div className="supplier-form-grid">
            <div className="supplier-form-two-columns">
              <div className="supplier-form-field">
                <label>Nome da categoria</label>
                <input
                  className="supplier-form-input"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div className="supplier-form-field">
                <label>Codigo interno</label>
                <input
                  className="supplier-form-input"
                  placeholder="Ex.: alimentacao"
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                />
                <p className="supplier-helper-text">
                  Se deixar em branco, o sistema gera o codigo automaticamente.
                </p>
              </div>
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Descricao</label>
              <input
                className="supplier-form-input"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Perguntas da avaliacao</label>
              <textarea
                className="category-form-textarea"
                placeholder="Escreva uma pergunta por linha"
                value={questionText}
                onChange={(event) => setQuestionText(event.target.value)}
              />
              <p className="supplier-helper-text">
                Exemplo: Qualidade da entrega, cumprimento de prazo, atendimento da equipe.
              </p>
            </div>

            <div className="supplier-form-field supplier-form-field-full">
              <label>Documentos obrigatorios</label>
              <textarea
                className="category-form-textarea"
                placeholder="Escreva um documento por linha"
                value={documentText}
                onChange={(event) => setDocumentText(event.target.value)}
              />
              <p className="supplier-helper-text">
                Esses documentos aparecerao automaticamente no cadastro do fornecedor, cada um com campo separado para PDF e vencimento.
              </p>
            </div>

            <label className="category-active-toggle">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              />
              <span>Categoria ativa</span>
            </label>

            {error ? <p className="error-text">{error}</p> : null}
            {message ? <p className="success-text">{message}</p> : null}

            <div className="supplier-form-actions">
              <button className="supplier-save-button" type="button" onClick={saveCategory}>
                {editingId ? "Salvar alteracoes" : "Salvar categoria"}
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="category-shell">
      <header className="supplier-hero">
        <div>
          <span className="dashboard-card-eyebrow supplier-hero-kicker">Questionarios por categoria</span>
          <h1>Categorias de fornecedores</h1>
          <p>Cadastre a categoria, as perguntas de avaliacao e os documentos obrigatorios na mesma tela.</p>
        </div>

        <div className="supplier-hero-actions">
          <button className="supplier-toolbar-button supplier-toolbar-button-primary" type="button" onClick={openNewCategory}>
            Nova categoria
          </button>
        </div>
      </header>

      <section className="supplier-list-card">
        <div className="supplier-table-wrap">
          <table className="supplier-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Codigo</th>
                <th>Perguntas</th>
                <th>Documentos</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {categories.length ? (
                categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <strong>{category.name}</strong>
                      <span>{category.description || "-"}</span>
                    </td>
                    <td>{category.slug}</td>
                    <td>{(category.questions || []).length}</td>
                    <td>{(category.documents || []).length}</td>
                    <td>{category.active ? "Ativa" : "Inativa"}</td>
                    <td>
                      <div className="supplier-action-row">
                        <button className="supplier-row-button" type="button" onClick={() => editCategory(category)}>
                          Editar
                        </button>
                        <button
                          className="supplier-row-button supplier-row-button-danger"
                          type="button"
                          onClick={() => deleteCategory(category.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="dashboard-empty-copy">
                    Nenhuma categoria cadastrada.
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
