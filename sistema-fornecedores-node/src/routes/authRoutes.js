const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// LOGIN
router.post('/login', authController.login);

// SESSION
router.get('/me', authMiddleware, authController.me);

// LOGOUT
router.get('/logout', authMiddleware, authController.logout);

module.exports = router;
