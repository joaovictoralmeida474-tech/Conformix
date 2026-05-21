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
const axisFont = { family: "'Inter', sans-serif", size: 11, weight: "500" };

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
              borderColor: "#ff9a6b",
              backgroundColor: "rgba(255, 154, 107, 0.14)",
              borderWidth: 2,
              pointBackgroundColor: "#ff9a6b",
              pointBorderColor: "#0a1628",
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              tension: 0.35,
              fill: true,
              order: 0
            },
            {
              type: "bar",
              label: "Nota",
              data: chartData.scores,
              backgroundColor: "rgba(13, 216, 255, 0.82)",
              hoverBackgroundColor: "rgba(0, 230, 180, 0.95)",
              borderRadius: 8,
              borderSkipped: false,
              maxBarThickness: 36,
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
                color: "#a8c4dc",
                usePointStyle: true,
                padding: 14,
                font: { ...axisFont, size: 11 }
              }
            },
            tooltip: {
              backgroundColor: "rgba(6, 18, 38, 0.96)",
              borderColor: "rgba(13, 216, 255, 0.28)",
              borderWidth: 1,
              padding: 12,
              cornerRadius: 8,
              titleColor: "#f4fbff",
              bodyColor: "#c4d8ea",
              titleFont: { ...axisFont, size: 12, weight: "600" },
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
                color: "#9eb4cc",
                font: { ...axisFont, size: 10, weight: "600" },
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
                color: "#6d8aa8",
                stepSize: 25,
                font: axisFont,
                callback: (value) => value
              },
              grid: {
                color: "rgba(55, 85, 130, 0.16)",
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
