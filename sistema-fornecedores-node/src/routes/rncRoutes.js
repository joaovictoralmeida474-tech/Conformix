const express = require('express');
const router = express.Router();

const rncController = require('../controllers/rncController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, rncController.list);
router.put('/:id', authMiddleware, rncController.update);

module.exports = router;
