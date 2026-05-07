function calculateFinalScore(quality, delivery, price, service, reliability) {
  const score =
    quality * 0.30 +
    delivery * 0.25 +
    price * 0.15 +
    service * 0.10 +
    reliability * 0.20;

  return Number(score.toFixed(2));
}

function classifyScore(score) {
  if (score >= 90) return "Excelente";
  if (score >= 70) return "Aprovado";
  return "Crítico";
}

function calculateTrend(evaluations) {
  if (evaluations.length < 2) return "stable";

  const latest = evaluations[0].finalScore;
  const previous = evaluations[1].finalScore;

  if (latest > previous) return "improving";
  if (latest < previous) return "worsening";

  return "stable";
}

function calculateRiskIndex(supplier) {
  const scores = supplier.evaluations.slice(0, 6).map((e) => e.finalScore);

  if (!scores.length) return 0;

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  let risk = 100 - avg;

  if (supplier.status === "blocked") risk += 20;

  return Math.min(100, Math.max(0, Number(risk.toFixed(2))));
}

module.exports = {
  calculateFinalScore,
  classifyScore,
  calculateTrend,
  calculateRiskIndex
};
