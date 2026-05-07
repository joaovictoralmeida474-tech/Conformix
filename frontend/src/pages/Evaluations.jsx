import { useState } from 'react';
import AppLayout from '../components/AppLayout';
import api from '../services/api';

const scoreOptions = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

export default function Evaluations() {
  const [supplierId, setSupplierId] = useState('');
  const [scores, setScores] = useState(['', '', '']);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    try {
      setMessage('');
      setError('');

      await api.post(`/evaluations/supplier/${supplierId}`, {
        answers: scores.map((score) => ({ score: Number(score) || 0 })),
      });

      setMessage('Avaliacao registrada com sucesso.');
    } catch (err) {
      setError(err.response?.data?.error || 'Nao foi possivel registrar a avaliacao.');
    }
  }

  return (
    <AppLayout>
      <div className="page-grid">
        <header className="page-header">
          <div>
            <span className="badge">Performance</span>
            <h1 className="page-title" style={{ marginTop: 10 }}>
              Nova avaliacao
            </h1>
            <p className="page-subtitle">
              Notas abaixo de 60 geram RNC automatica e status de revisao.
            </p>
          </div>
        </header>

        <section className="panel">
          <div className="form-grid">
            <input
              className="input"
              placeholder="ID do fornecedor"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            />

            <div className="field-grid">
              {scores.map((score, index) => (
                <select
                  key={index}
                  className="input"
                  value={score}
                  onChange={(event) => {
                    const next = [...scores];
                    next[index] = event.target.value;
                    setScores(next);
                  }}
                >
                  <option value="">{`Selecione a nota ${index + 1}`}</option>
                  {scoreOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ))}
            </div>

            <div className="button-row">
              <button className="button" type="button" onClick={submit}>
                Enviar avaliacao
              </button>
            </div>

            {message ? <p className="success-text">{message}</p> : null}
            {error ? <p className="error-text">{error}</p> : null}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
