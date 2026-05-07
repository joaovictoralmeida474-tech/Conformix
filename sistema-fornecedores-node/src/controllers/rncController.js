const rncService = require('../services/rncService');

async function list(req, res) {
  const items = await rncService.list();
  res.json(items);
}

async function update(req, res) {
  try {
    const updated = await rncService.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  list,
  update
};
