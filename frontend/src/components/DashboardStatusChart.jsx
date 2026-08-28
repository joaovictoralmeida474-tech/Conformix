import { useMemo } from "react";
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const axisFont = { family: "'IBM Plex Sans', 'Segoe UI', sans-serif", size: 10, weight: "500" };

export default function DashboardStatusChart({ title, items = [], emptyLabel = "Sem dados" }) {
  const chart = useMemo(() => {
    const rows = (items || []).filter((item) => Number(item.value) > 0);
    return {
      rows,
      labels: rows.map((item) => item.label),
      values: rows.map((item) => Number(item.value) || 0),
      colors: rows.map((item) => item.color)
    };
  }, [items]);

  const total = chart.values.reduce((sum, value) => sum + value, 0);

  if (!total) {
    return <p className="dashboard-chart-empty">{emptyLabel}</p>;
  }

  return (
    <div className="dashboard-status-chart">
      <div className="dashboard-status-chart-canvas">
        <Doughnut
          data={{
            labels: chart.labels,
            datasets: [
              {
                data: chart.values,
                backgroundColor: chart.colors,
                borderColor: "#0a1628",
                borderWidth: 3,
                hoverOffset: 4
              }
            ]
          }}
          options={{
            maintainAspectRatio: false,
            cutout: "68%",
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: "rgba(10, 22, 40, 0.98)",
                borderColor: "rgba(13, 216, 255, 0.3)",
                borderWidth: 1,
                padding: 10,
                cornerRadius: 8,
                titleColor: "#e8f4fb",
                bodyColor: "#8eb8d0",
                titleFont: { ...axisFont, size: 11, weight: "600" },
                bodyFont: axisFont
              }
            }
          }}
        />
        <div className="dashboard-status-chart-center">
          <strong>{total}</strong>
          <span>{title}</span>
        </div>
      </div>

      <ul className="dashboard-status-legend">
        {chart.rows.map((item) => (
          <li key={item.label}>
            <span className="dashboard-status-legend-swatch" style={{ background: item.color }} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
