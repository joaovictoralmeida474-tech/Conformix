const evaluationService = require('../services/evaluationService');

async function create(req, res) {
  try {
    const supplierId = Number(req.params.supplierId);
    const userId = req.user.id;

    const {
      answers,
      invoiceNumber,
      observations,
      evaluationDate
    } = req.body;

    const evaluation = await evaluationService.create({
      supplierId,
      evaluatorId: userId,
      answers,
      invoiceNumber,
      observations,
      evaluationDate
    });

    return res.json({
      message: 'Avaliação registrada com sucesso',
      evaluation
    });
  } catch (err) {
    return res.status(400).json({
      error: err.message
    });
  }
}

module.exports = {
  create
};
