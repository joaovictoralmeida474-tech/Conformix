const express = require('express');
const router = express.Router();

const evaluationController = require('../controllers/evaluationController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/supplier/:supplierId', authMiddleware, evaluationController.create);

module.exports = router;
