import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cachedGet } from "../services/cachedApi";

const DashboardRiskChart = lazy(() => import("../components/DashboardRiskChart"));
const DashboardStatusChart = lazy(() => import("../components/DashboardStatusChart"));

const ALERT_LABELS = {
  documento_vencido: "Documento vencido",
  documento_vencendo: "Documento a vencer",
  avaliacao_vencida: "Avaliacao vencida",
  fornecedor_bloqueado: "Fornecedor bloqueado",
  rnc_vencida: "RNC vencida"
};

function formatAlertType(type) {
  return ALERT_LABELS[type] || String(type || "").replaceAll("_", " ");
}

function formatStatus(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "BLOQUEADO") return "Bloqueado";
  if (normalized === "ATIVO") return "Ativo";
  return status || "-";
}

function formatMoneyCompact(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  });
}

export default function Dashboard() {
  const location = useLocation();
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
    invoicesThisMonth: 0,
    invoicesAmountThisMonth: 0,
    invoicesApproved: 0,
    invoicesInReview: 0,
    invoicesPending: 0,
    labels: [],
    scores: [],
    risks: []
  });

  useEffect(() => {
    if (location.pathname !== "/dashboard") {
      return;
    }

    let cancelled = false;

    cachedGet("/dashboard", {}, { force: true }).then((response) => {
      if (!cancelled) {
        setData(response.data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long"
      }),
    []
  );

  const kpis = [
    {
      key: "suppliers",
      label: "Fornecedores",
      value: data.total,
      hint: `${data.criticalSuppliers || 0} criticos · ${data.bloqueados || 0} bloqueados`,
      to: "/suppliers"
    },
    {
      key: "score",
      label: "Media de avaliacao",
      value: Number(data.averageScore || 0).toFixed(1),
      hint: "Desempenho consolidado da base",
      to: "/suppliers"
    },
    {
      key: "rnc",
      label: "RNCs abertas",
      value: data.rnc || 0,
      hint: `${(data.overdueRncs || []).length} vencidas`,
      to: "/rnc",
      tone: (data.rnc || 0) > 0 ? "warn" : undefined
    },
    {
      key: "nfs",
      label: "NFS no mes",
      value: data.invoicesThisMonth || 0,
      hint: `${data.invoicesInReview || 0} em analise · ${data.invoicesPending || 0} pendentes`,
      to: "/nfs"
    },
    {
      key: "nfs-amount",
      label: "Valor NFS no mes",
      value: formatMoneyCompact(data.invoicesAmountThisMonth || 0),
      hint: "Total liquido emitido no mes",
      to: "/nfs",
      compact: true
    }
  ];

  const invoiceStatusItems = [
    { label: "Aprovadas", value: data.invoicesApproved || 0, color: "#00e6b4" },
    { label: "Em analise", value: data.invoicesInReview || 0, color: "#0dd8ff" },
    { label: "Com pendencia", value: data.invoicesPending || 0, color: "#ff8f8f" }
  ];

  const pendingMixItems = [
    { label: "RNCs abertas", value: data.rnc || 0, color: "#f5c76a" },
    { label: "Docs / alertas", value: (data.alerts || []).length, color: "#1ea0ff" },
    { label: "NFS pendentes", value: data.invoicesPending || 0, color: "#ff8f8f" },
    { label: "Bloqueados", value: data.bloqueados || 0, color: "#ff7b7b" }
  ];

  const priorities = useMemo(() => {
    const items = [];

    (data.alerts || []).slice(0, 5).forEach((alert, index) => {
      items.push({
        id: `alert-${alert.type}-${alert.supplierId}-${index}`,
        title: formatAlertType(alert.type),
        detail: alert.message,
        tone:
          alert.type === "fornecedor_bloqueado" ||
          alert.type === "documento_vencido" ||
          alert.type === "rnc_vencida"
            ? "danger"
            : "warn"
      });
    });

    (data.openRncs || []).slice(0, 4).forEach((item) => {
      items.push({
        id: `rnc-${item.id}`,
        title: `RNC #${item.id}`,
        detail: `${item.supplier?.name || "Fornecedor"}${
          item.deadline ? ` · prazo ${new Date(item.deadline).toLocaleDateString("pt-BR")}` : ""
        }`,
        tone: "warn"
      });
    });

    return items.slice(0, 6);
  }, [data.alerts, data.openRncs]);

  const ranking = (data.ranking || []).slice(0, 6);
  const chartLabels = (data.labels || []).slice(0, 12);
  const chartScores = (data.scores || []).slice(0, 12);
  const chartRisks = (data.risks || []).slice(0, 12);

  return (
    <div className="dashboard-shell dashboard-shell--showcase">
      <header className="dashboard-overview-header">
        <div>
          <span className="dashboard-card-eyebrow">Painel operacional</span>
          <h1>Visao geral</h1>
          <p>Acompanhe desempenho, pendencias e notas fiscais em um so lugar.</p>
        </div>
        <time className="dashboard-overview-date" dateTime={new Date().toISOString()}>
          {dateLabel}
        </time>
      </header>

      <section className="dashboard-kpi-strip" aria-label="Indicadores principais">
        {kpis.map((kpi) => (
          <Link
            key={kpi.key}
            to={kpi.to}
            className={`dashboard-kpi-card${kpi.tone ? ` dashboard-kpi-card--${kpi.tone}` : ""}${
              kpi.compact ? " dashboard-kpi-card--compact" : ""
            }`}
          >
            <span className="dashboard-card-eyebrow">{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <p>{kpi.hint}</p>
          </Link>
        ))}
      </section>

      <section className="dashboard-showcase-main">
        <article className="dashboard-panel dashboard-chart-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="dashboard-card-eyebrow">Desempenho</span>
              <h3>Nota x risco dos fornecedores</h3>
            </div>
            <Link className="dashboard-inline-link" to="/suppliers">
              Ver fornecedores
            </Link>
          </div>
          <div className="dashboard-chart-wrap dashboard-chart-wrap--tall">
            <Suspense fallback={<p className="dashboard-empty-copy">Carregando grafico...</p>}>
              <DashboardRiskChart labels={chartLabels} scores={chartScores} risks={chartRisks} />
            </Suspense>
          </div>
          <p className="dashboard-footnote">Barras = nota de avaliacao · linha = indice de risco</p>
        </article>

        <div className="dashboard-showcase-side">
          <article className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div>
                <span className="dashboard-card-eyebrow">Notas fiscais</span>
                <h3>Status das NFS</h3>
              </div>
              <Link className="dashboard-inline-link" to="/nfs">
                Abrir
              </Link>
            </div>
            <Suspense fallback={<p className="dashboard-empty-copy">Carregando...</p>}>
              <DashboardStatusChart
                title="total"
                items={invoiceStatusItems}
                emptyLabel="Nenhuma nota fiscal registrada."
              />
            </Suspense>
          </article>

          <article className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div>
                <span className="dashboard-card-eyebrow">Operacao</span>
                <h3>Pendencias</h3>
              </div>
            </div>
            <Suspense fallback={<p className="dashboard-empty-copy">Carregando...</p>}>
              <DashboardStatusChart
                title="itens"
                items={pendingMixItems}
                emptyLabel="Nenhuma pendencia no momento."
              />
            </Suspense>
          </article>
        </div>
      </section>

      <section className="dashboard-showcase-bottom">
        <article className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="dashboard-card-eyebrow">Fila de atencao</span>
              <h3>Prioridades e alertas</h3>
            </div>
            <Link className="dashboard-inline-link" to="/rnc">
              Ver RNC
            </Link>
          </div>

          <div className="dashboard-priority-list">
            {priorities.length ? (
              priorities.map((item) => (
                <div
                  key={item.id}
                  className={`dashboard-priority-item dashboard-priority-item--${item.tone}`}
                >
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))
            ) : (
              <p className="dashboard-empty-copy">Nenhuma pendencia critica no momento.</p>
            )}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="dashboard-card-eyebrow">Ranking</span>
              <h3>Melhores fornecedores</h3>
            </div>
            <Link className="dashboard-inline-link" to="/suppliers">
              Ver base
            </Link>
          </div>

          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fornecedor</th>
                  <th>Status</th>
                  <th>Nota</th>
                  <th>Risco</th>
                </tr>
              </thead>
              <tbody>
                {ranking.length ? (
                  ranking.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>{item.name}</td>
                      <td>
                        <span className="dashboard-status-text">{formatStatus(item.status)}</span>
                      </td>
                      <td>{Number(item.score || 0).toFixed(1)}</td>
                      <td>{Number(item.riskIndex || 0).toFixed(1)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="dashboard-empty-copy">
                      Nenhum fornecedor avaliado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
