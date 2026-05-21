import { useMemo } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ScatterController
} from "chart.js";
import { Scatter } from "react-chartjs-2";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, ScatterController);

const ZONE = {
  ok: {
    label: "Desempenho saudavel",
    fill: "rgba(0, 230, 180, 0.88)",
    border: "#00e6b4",
    hover: "rgba(0, 230, 180, 1)"
  },
  warning: {
    label: "Atencao",
    fill: "rgba(255, 171, 87, 0.9)",
    border: "#ffab57",
    hover: "rgba(255, 171, 87, 1)"
  },
  critical: {
    label: "Risco elevado",
    fill: "rgba(255, 107, 129, 0.9)",
    border: "#ff6b81",
    hover: "rgba(255, 107, 129, 1)"
  }
};

function classifyPoint(score, risk) {
  if (score < 50 || risk >= 60) return "critical";
  if (score < 70 || risk >= 40) return "warning";
  return "ok";
}

const quadrantPlugin = {
  id: "riskQuadrantGuides",
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.x || !scales.y) return;

    const midX = scales.x.getPixelForValue(50);
    const midY = scales.y.getPixelForValue(50);

    ctx.save();
    ctx.strokeStyle = "rgba(13, 216, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(midX, chartArea.top);
    ctx.lineTo(midX, chartArea.bottom);
    ctx.moveTo(chartArea.left, midY);
    ctx.lineTo(chartArea.right, midY);
    ctx.stroke();
    ctx.restore();
  }
};

const axisFont = { family: "'Inter', sans-serif", size: 11, weight: "500" };

export default function DashboardRiskChart({ labels, scores, risks }) {
  const { datasets, isEmpty } = useMemo(() => {
    const buckets = { ok: [], warning: [], critical: [] };

    labels.forEach((name, index) => {
      const score = Number(scores[index] ?? 0);
      const risk = Number(risks[index] ?? 0);
      const zone = classifyPoint(score, risk);
      buckets[zone].push({ x: risk, y: score, label: name });
    });

    const built = ["ok", "warning", "critical"]
      .filter((key) => buckets[key].length > 0)
      .map((key) => ({
        label: ZONE[key].label,
        data: buckets[key],
        backgroundColor: ZONE[key].fill,
        borderColor: ZONE[key].border,
        hoverBackgroundColor: ZONE[key].hover,
        hoverBorderColor: "#ffffff",
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBorderWidth: 2,
        pointHoverBorderWidth: 2
      }));

    return {
      datasets: built,
      isEmpty: built.length === 0
    };
  }, [labels, scores, risks]);

  if (isEmpty) {
    return <p className="dashboard-chart-empty">Sem dados para exibir no grafico.</p>;
  }

  return (
    <div className="dashboard-risk-chart">
      <Scatter
        plugins={[quadrantPlugin]}
        data={{ datasets }}
        options={{
          maintainAspectRatio: false,
          responsive: true,
          interaction: { mode: "nearest", intersect: true },
          layout: { padding: { top: 4, right: 12, bottom: 4, left: 4 } },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: {
                color: "#a8c4dc",
                usePointStyle: true,
                pointStyle: "circle",
                padding: 16,
                font: { ...axisFont, size: 11 }
              }
            },
            tooltip: {
              backgroundColor: "rgba(6, 18, 38, 0.96)",
              borderColor: "rgba(13, 216, 255, 0.35)",
              borderWidth: 1,
              padding: 12,
              cornerRadius: 10,
              titleColor: "#f4fbff",
              bodyColor: "#c4d8ea",
              titleFont: { ...axisFont, size: 12, weight: "600" },
              bodyFont: axisFont,
              displayColors: true,
              callbacks: {
                title: (items) => items[0]?.raw?.label || "Fornecedor",
                label: (ctx) => [
                  `Nota: ${ctx.parsed.y}`,
                  `Risco: ${ctx.parsed.x}`
                ]
              }
            }
          },
          scales: {
            x: {
              min: 0,
              max: 100,
              title: {
                display: true,
                text: "Indice de risco",
                color: "#7eb8d8",
                font: { ...axisFont, size: 11, weight: "600" },
                padding: { top: 8 }
              },
              ticks: {
                color: "#6d8aa8",
                stepSize: 25,
                maxTicksLimit: 5,
                font: axisFont
              },
              grid: { color: "rgba(55, 85, 130, 0.2)", drawTicks: false },
              border: { display: false }
            },
            y: {
              min: 0,
              max: 100,
              title: {
                display: true,
                text: "Nota de desempenho",
                color: "#7eb8d8",
                font: { ...axisFont, size: 11, weight: "600" },
                padding: { bottom: 8 }
              },
              ticks: {
                color: "#6d8aa8",
                stepSize: 25,
                maxTicksLimit: 5,
                font: axisFont
              },
              grid: { color: "rgba(55, 85, 130, 0.2)", drawTicks: false },
              border: { display: false }
            }
          }
        }}
      />
    </div>
  );
}
