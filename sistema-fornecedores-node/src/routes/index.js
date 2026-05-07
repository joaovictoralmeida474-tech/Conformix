const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const evaluationRoutes = require('./evaluationRoutes');
const rncRoutes = require('./rncRoutes');
const supplierRoutes = require('./supplierRoutes');

router.use('/auth', authRoutes);
router.use('/evaluations', evaluationRoutes);
router.use('/rnc', rncRoutes);
router.use('/suppliers', supplierRoutes);

module.exports = router;
