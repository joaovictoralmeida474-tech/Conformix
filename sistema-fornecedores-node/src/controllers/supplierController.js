const supplierService = require('../services/supplierService');

async function list(req, res) {
  const { search, status } = req.query;

  const suppliers = await supplierService.list({ search, status });

  res.json(suppliers);
}

async function create(req, res) {
  try {
    const supplier = await supplierService.create(req.body);
    res.json(supplier);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function update(req, res) {
  try {
    const supplier = await supplierService.update(req.params.id, req.body);
    res.json(supplier);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function remove(req, res) {
  try {
    await supplierService.remove(req.params.id);
    res.json({ message: 'Fornecedor removido' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function detail(req, res) {
  const supplier = await supplierService.detail(req.params.id);
  res.json(supplier);
}

async function cnpjLookup(req, res) {
  try {
    const data = await supplierService.fetchCNPJ(req.params.cnpj);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  detail,
  cnpjLookup
};
