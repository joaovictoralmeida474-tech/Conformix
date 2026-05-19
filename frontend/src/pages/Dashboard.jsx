import { useEffect, useState } from "react";
import { cachedGet } from "../services/cachedApi";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  Legend,
  PointElement,
  LineElement
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  PointElement,
  LineElement
);

export default function Dashboard() {
  const [data, setData] = useState({
    total: 0,
    criticalSuppliers: 0,
    bloqueados: 0,
    rnc: 0,
    expiring: 0,
    averageScore: 0,
    ranking: [],
    alerts: [],
    openRncs: [],
    overdueRncs: [],
    labels: [],
    scores: [],
    risks: []
  });

  useEffect(() => {
    cachedGet("/dashboard").then((res) => setData(res.data));
  }, []);

  const chartLabels = data.labels.slice(0, 20);
  const chartScores = data.scores.slice(0, 20);
  const chartRisks = data.risks.slice(0, 20);

  const cards = [
    {
      eyebrow: "Total de fornecedores",
      title: data.total,
      description: "Base monitorada"
    },
    {
      eyebrow: "Fornecedores criticos",
      title: data.criticalSuppliers,
      description: "Maior prioridade"
    },
    {
      eyebrow: "Media geral",
      title: Number(data.averageScore || 0).toFixed(2),
      description: "Indicador consolidado"
    }
  ];

  const monitoringAlerts = data.alerts.filter((alert) =>
    ["documento_vencido", "documento_vencendo", "avaliacao_vencida", "fornecedor_bloqueado"].includes(alert.type)
  );

  return (
    <div className="dashboard-shell">
      <section className="dashboard-top-grid">
        {cards.map((card) => (
          <article key={card.eyebrow} className="dashboard-stat-card">
            <span className="dashboard-card-eyebrow">{card.eyebrow}</span>
            <strong>{card.title}</strong>
            <p>{card.description}</p>
          </article>
        ))}
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-panel dashboard-chart-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="dashboard-card-eyebrow">Radar operacional</span>
              <h3>Desempenho x risco</h3>
            </div>
          </div>
          <div className="dashboard-chart-wrap">
            <Bar
              data={{
                labels: chartLabels,
                datasets: [
                  {
                    label: "Nota",
                    backgroundColor: "#54d8c8",
                    borderRadius: 999,
                    borderSkipped: false,
                    barThickness: 12,
                    data: chartScores
                  },
                  {
                    label: "Risco",
                    backgroundColor: "#ff8c5a",
                    borderRadius: 999,
                    borderSkipped: false,
                    barThickness: 12,
                    data: chartRisks
                  }
                ]
              }}
              options={{
                indexAxis: "y",
                maintainAspectRatio: false,
                responsive: true,
                layout: { padding: { top: 8, right: 8, bottom: 0, left: 8 } },
                plugins: {
                  legend: {
                    position: "top",
                    labels: {
                      color: "#d8e5fb",
                      usePointStyle: true,
                      pointStyle: "circle",
                      boxWidth: 8,
                      boxHeight: 8
                    }
                  },
                  tooltip: {
                    backgroundColor: "#091426",
                    borderColor: "rgba(81, 138, 225, 0.28)",
                    borderWidth: 1,
                    titleColor: "#f5f9ff",
                    bodyColor: "#c4d4ea"
                  }
                },
                scales: {
                  x: {
                    min: 0,
                    max: 100,
                    ticks: { color: "#8fa4c2", stepSize: 20 },
                    grid: { color: "rgba(66, 93, 145, 0.22)" },
                    border: { display: false }
                  },
                  y: {
                    ticks: { color: "#dce7f8", font: { size: 10, weight: "600" } },
                    grid: { display: false },
                    border: { display: false }
                  }
                }
              }}
            />
          </div>
          <p className="dashboard-footnote">
            Ate 20 fornecedores sao exibidos para manter o painel leve e legivel.
          </p>
        </div>

        <div className="dashboard-side-stack">
          <div className="dashboard-panel dashboard-mini-panel">
            <div>
              <span className="dashboard-card-eyebrow">Monitoramento</span>
              <h3>Alertas ativos</h3>
            </div>
            <div className="stack-list">
              {monitoringAlerts.length ? (
                monitoringAlerts.slice(0, 4).map((alert, index) => (
                  <div key={`${alert.type}-${alert.supplierId}-${index}`} className="dashboard-alert-item">
                    <strong>{alert.type.replaceAll("_", " ")}</strong>
                    <p>{alert.message}</p>
                  </div>
                ))
              ) : (
                <p className="dashboard-empty-copy">Nenhum alerta ativo.</p>
              )}
            </div>
          </div>

          <div className="dashboard-panel dashboard-mini-panel">
            <div>
              <span className="dashboard-card-eyebrow">Pendencias</span>
              <h3>RNCs em aberto</h3>
            </div>
            <div className="stack-list">
              {data.openRncs.length ? (
                data.openRncs.slice(0, 3).map((item) => (
                  <div key={item.id} className="dashboard-alert-item">
                    <strong>RNC #{item.id}</strong>
                    <p>
                      {item.supplier?.name || "Fornecedor sem nome"}{" "}
                      {item.deadline ? `- vence em ${new Date(item.deadline).toLocaleDateString("pt-BR")}` : "- sem prazo"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="dashboard-empty-copy">Nenhuma RNC em aberto.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-panel dashboard-table-panel">
        <div className="dashboard-panel-heading">
          <div>
            <span className="dashboard-card-eyebrow">Melhores resultados</span>
            <h3>Ranking de fornecedores</h3>
          </div>
        </div>
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Status</th>
                <th>Ultima nota</th>
                <th>Risco</th>
              </tr>
            </thead>
            <tbody>
              {data.ranking.length ? (
                data.ranking.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>
                      <span className="dashboard-status-text">{item.status}</span>
                    </td>
                    <td>{Number(item.score || 0).toFixed(2)}</td>
                    <td>{Number(item.riskIndex || 0).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="dashboard-empty-copy">
                    Nenhum fornecedor avaliado ainda.
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
