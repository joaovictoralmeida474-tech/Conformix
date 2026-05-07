export function calculateScore(answers = []) {
  if (!Array.isArray(answers) || answers.length === 0) {
    return 0;
  }

  const numericAnswers = answers.map(Number).filter((value) => !Number.isNaN(value));

  if (!numericAnswers.length) {
    return 0;
  }

  const total = numericAnswers.reduce((sum, value) => sum + value, 0);
  return total / numericAnswers.length;
}
