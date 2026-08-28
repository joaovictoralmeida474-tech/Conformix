import { useMemo } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Tooltip,
  Legend,
  Filler
);

const TOP_N = 10;
const axisFont = { family: "'IBM Plex Sans', 'Segoe UI', sans-serif", size: 10, weight: "500" };

function shortName(name, max = 12) {
  if (!name) return "—";
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function prepareRows(labels, scores, risks) {
  return labels
    .map((name, index) => ({
      name,
      score: Number(scores[index]) || 0,
      risk: Number(risks[index]) || 0
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);
}

export default function DashboardRiskChart({ labels, scores, risks }) {
  const chartData = useMemo(() => {
    const rows = prepareRows(labels, scores, risks);
    return {
      rows,
      labels: rows.map((row) => shortName(row.name)),
      fullNames: rows.map((row) => row.name),
      scores: rows.map((row) => row.score),
      risks: rows.map((row) => row.risk)
    };
  }, [labels, scores, risks]);

  if (!chartData.rows.length) {
    return <p className="dashboard-chart-empty">Sem dados para exibir no grafico.</p>;
  }

  return (
    <div className="dashboard-risk-chart">
      <Chart
        type="bar"
        data={{
          labels: chartData.labels,
          datasets: [
            {
              type: "line",
              label: "Indice de risco",
              data: chartData.risks,
              borderColor: "#1ea0ff",
              backgroundColor: "rgba(30, 160, 255, 0.14)",
              borderWidth: 2,
              pointBackgroundColor: "#1ea0ff",
              pointBorderColor: "#020c1b",
              pointBorderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 5,
              tension: 0.35,
              fill: true,
              order: 0
            },
            {
              type: "bar",
              label: "Nota",
              data: chartData.scores,
              backgroundColor: "rgba(0, 230, 180, 0.85)",
              hoverBackgroundColor: "rgba(13, 216, 255, 0.95)",
              borderRadius: 7,
              borderSkipped: false,
              maxBarThickness: 32,
              order: 1
            }
          ]
        }}
        options={{
          maintainAspectRatio: false,
          responsive: true,
          interaction: { mode: "index", intersect: false },
          layout: { padding: { top: 8, right: 8, bottom: 0, left: 0 } },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: {
                color: "#8eb8d0",
                usePointStyle: true,
                padding: 12,
                font: { ...axisFont, size: 10 }
              }
            },
            tooltip: {
              backgroundColor: "rgba(10, 22, 40, 0.98)",
              borderColor: "rgba(13, 216, 255, 0.3)",
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
              titleColor: "#e8f4fb",
              bodyColor: "#8eb8d0",
              titleFont: { ...axisFont, size: 11, weight: "600" },
              bodyFont: axisFont,
              callbacks: {
                title: (items) => chartData.fullNames[items[0]?.dataIndex] || "",
                label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`
              }
            }
          },
          scales: {
            x: {
              ticks: {
                color: "#8eb8d0",
                font: { ...axisFont, size: 9, weight: "600" },
                maxRotation: 40,
                minRotation: 40,
                autoSkip: false
              },
              grid: { display: false },
              border: { display: false }
            },
            y: {
              min: 0,
              max: 100,
              ticks: {
                color: "#6a93ad",
                stepSize: 25,
                font: axisFont,
                callback: (value) => value
              },
              grid: {
                color: "rgba(13, 216, 255, 0.08)",
                drawBorder: false
              },
              border: { display: false }
            }
          }
        }}
      />
    </div>
  );
}
