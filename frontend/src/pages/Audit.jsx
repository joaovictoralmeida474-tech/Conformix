import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function Audit() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/audit", { params: { limit: 100 } })
      .then((response) => setItems(response.data))
      .catch(() => setError("Nao foi possivel carregar a trilha de auditoria."));
  }, []);

  return (
    <div className="page-grid">
      <header className="page-header">
        <div>
          <span className="badge">Rastreabilidade</span>
          <h1 className="page-title" style={{ marginTop: 10 }}>
            Auditoria
          </h1>
          <p className="page-subtitle">
            Historico de acoes executadas no sistema por usuario e data.
          </p>
        </div>
      </header>

      <section className="table-card">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Usuario</th>
              <th>Acao</th>
              <th>Entidade</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
                  <td>{item.user?.email || "-"}</td>
                  <td>{item.action}</td>
                  <td>{item.entity || "-"}</td>
                  <td>{item.details || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="empty-state">
                  {error || "Nenhum evento auditado ainda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
