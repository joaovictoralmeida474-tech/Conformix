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

export default function DashboardRiskChart({ labels, scores, risks }) {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: "Nota",
            backgroundColor: "#54d8c8",
            borderRadius: 999,
            borderSkipped: false,
            barThickness: 12,
            data: scores
          },
          {
            label: "Risco",
            backgroundColor: "#ff8c5a",
            borderRadius: 999,
            borderSkipped: false,
            barThickness: 12,
            data: risks
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
  );
}
