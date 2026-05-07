const express = require('express');
const router = express.Router();

const supplierController = require('../controllers/supplierController');
const evaluationController = require('../controllers/evaluationController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, supplierController.list);
router.post('/', authMiddleware, supplierController.create);
router.get('/cnpj/:cnpj', authMiddleware, supplierController.cnpjLookup);
router.post('/:supplierId/evaluations', authMiddleware, evaluationController.create);
router.put('/:id', authMiddleware, supplierController.update);
router.delete('/:id', authMiddleware, supplierController.remove);
router.get('/:id', authMiddleware, supplierController.detail);

module.exports = router;
