import { useState } from 'react';
import AppLayout from '../components/AppLayout';
import api from '../services/api';
import { buscarCNPJ } from '../services/cnpj';

export default function CreateSupplier() {
  const [form, setForm] = useState({
    name: '',
    cnpj: '',
    categoryId: '1',
    status: 'active',
    nextReview: '',
  });
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleBuscarCNPJ() {
    try {
      setError('');
      const data = await buscarCNPJ(form.cnpj);
      setForm((prev) => ({
        ...prev,
        cnpj: data.cnpj || prev.cnpj,
        name: data.razao_social || prev.name,
      }));
      setMessage('Dados do CNPJ preenchidos automaticamente.');
    } catch (err) {
      setError('Nao foi possivel consultar o CNPJ agora.');
    }
  }

  async function handleUpload() {
    if (!file) {
      return;
    }

    const payload = new FormData();
    payload.append('file', file);
    await api.post('/upload', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      await api.post('/suppliers', form);
      await handleUpload();
      setMessage('Fornecedor criado com sucesso.');
    } catch (err) {
      setError(err.response?.data?.error || 'Nao foi possivel salvar o fornecedor.');
    }
  }

  return (
    <AppLayout>
      <div className="page-grid">
        <header className="page-header">
          <div>
            <span className="badge">Cadastro</span>
            <h1 className="page-title" style={{ marginTop: 10 }}>
              Novo fornecedor
            </h1>
            <p className="page-subtitle">
              Consulta automatica de CNPJ e envio opcional de documentos.
            </p>
          </div>
        </header>

        <section className="panel">
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field-grid">
              <input
                className="input"
                name="name"
                placeholder="Nome do fornecedor"
                value={form.name}
                onChange={handleChange}
                required
              />
              <div className="button-row">
                <input
                  className="input"
                  name="cnpj"
                  placeholder="CNPJ"
                  value={form.cnpj}
                  onChange={handleChange}
                  required
                />
                <button className="ghost-button" type="button" onClick={handleBuscarCNPJ}>
                  Buscar CNPJ
                </button>
              </div>
            </div>

            <div className="field-grid">
              <select
                className="select"
                name="categoryId"
                value={form.categoryId}
                onChange={handleChange}
              >
                <option value="1">Categoria 1</option>
              </select>
              <select
                className="select"
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                <option value="active">Ativo</option>
                <option value="blocked">Bloqueado</option>
                <option value="review">Em revisao</option>
              </select>
            </div>

            <input
              className="input"
              name="nextReview"
              type="date"
              value={form.nextReview}
              onChange={handleChange}
            />

            <input
              className="input"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />

            <div className="button-row">
              <button className="button" type="submit">
                Salvar fornecedor
              </button>
            </div>

            {message ? <p className="success-text">{message}</p> : null}
            {error ? <p className="error-text">{error}</p> : null}
          </form>
        </section>
      </div>
    </AppLayout>
  );
}
