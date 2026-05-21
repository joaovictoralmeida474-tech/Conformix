import { useMemo } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  Legend
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const axisFont = { family: "'Inter', sans-serif", size: 11, weight: "500" };

function truncateLabel(name, max = 26) {
  if (!name || name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function scoreColor(value) {
  const score = Number(value) || 0;
  if (score >= 80) return "rgba(0, 230, 180, 0.9)";
  if (score >= 60) return "rgba(13, 216, 255, 0.88)";
  if (score >= 40) return "rgba(30, 160, 255, 0.82)";
  return "rgba(90, 120, 165, 0.75)";
}

function riskColor(value) {
  const risk = Number(value) || 0;
  if (risk >= 60) return "rgba(255, 107, 129, 0.88)";
  if (risk >= 40) return "rgba(255, 171, 87, 0.88)";
  return "rgba(130, 165, 200, 0.55)";
}

const barRadius = { topRight: 5, bottomRight: 5, topLeft: 0, bottomLeft: 0 };

export default function DashboardRiskChart({ labels, scores, risks }) {
  const chartHeight = useMemo(() => {
    const rows = Math.max(labels.length, 1);
    return Math.min(520, Math.max(260, rows * 34 + 88));
  }, [labels.length]);

  const displayLabels = useMemo(
    () => labels.map((name) => truncateLabel(name)),
    [labels]
  );

  const scoreValues = useMemo(
    () => scores.map((value) => Number(value) || 0),
    [scores]
  );

  const riskValues = useMemo(
    () => risks.map((value) => Number(value) || 0),
    [risks]
  );

  if (!labels.length) {
    return <p className="dashboard-chart-empty">Sem dados para exibir no grafico.</p>;
  }

  return (
    <div className="dashboard-risk-chart" style={{ height: chartHeight }}>
      <Bar
        data={{
          labels: displayLabels,
          datasets: [
            {
              label: "Nota",
              data: scoreValues,
              backgroundColor: scoreValues.map(scoreColor),
              borderRadius: barRadius,
              borderSkipped: false,
              barThickness: 11,
              maxBarThickness: 12,
              order: 1
            },
            {
              label: "Risco",
              data: riskValues,
              backgroundColor: riskValues.map(riskColor),
              borderRadius: barRadius,
              borderSkipped: false,
              barThickness: 11,
              maxBarThickness: 12,
              order: 2
            }
          ]
        }}
        options={{
          indexAxis: "y",
          maintainAspectRatio: false,
          responsive: true,
          layout: { padding: { top: 6, right: 14, bottom: 2, left: 2 } },
          datasets: {
            bar: {
              categoryPercentage: 0.72,
              barPercentage: 0.82
            }
          },
          plugins: {
            legend: {
              position: "bottom",
              align: "center",
              labels: {
                color: "#9eb8d0",
                usePointStyle: true,
                pointStyle: "rectRounded",
                boxWidth: 10,
                boxHeight: 10,
                padding: 18,
                font: { ...axisFont, size: 11 }
              }
            },
            tooltip: {
              backgroundColor: "rgba(6, 18, 38, 0.96)",
              borderColor: "rgba(13, 216, 255, 0.3)",
              borderWidth: 1,
              padding: 12,
              cornerRadius: 8,
              titleColor: "#f4fbff",
              bodyColor: "#c4d8ea",
              titleFont: { ...axisFont, size: 12, weight: "600" },
              bodyFont: axisFont,
              callbacks: {
                title: (items) => labels[items[0]?.dataIndex] || "Fornecedor",
                label: (ctx) => {
                  const value = ctx.parsed.x ?? 0;
                  return `${ctx.dataset.label}: ${value}`;
                },
                afterBody: (items) => {
                  if (!items.length) return [];
                  const index = items[0].dataIndex;
                  const score = scoreValues[index];
                  const risk = riskValues[index];
                  if (items.length === 1) {
                    const missing = items[0].dataset.label === "Nota" ? `Risco: ${risk}` : `Nota: ${score}`;
                    return [missing];
                  }
                  return [];
                }
              }
            }
          },
          scales: {
            x: {
              min: 0,
              max: 100,
              ticks: {
                color: "#6d8aa8",
                stepSize: 20,
                font: axisFont,
                callback: (value) => `${value}`
              },
              grid: {
                color: "rgba(55, 85, 130, 0.18)",
                drawTicks: false
              },
              border: { display: false }
            },
            y: {
              ticks: {
                color: "#c8d8ea",
                font: { ...axisFont, size: 10, weight: "600" },
                autoSkip: false,
                padding: 6
              },
              grid: { display: false },
              border: { display: false }
            }
          }
        }}
      />
    </div>
  );
}
