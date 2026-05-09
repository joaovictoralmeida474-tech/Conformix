const authService = require('../services/authService');

async function login(req, res) {
  try {
    const { email, password, senha } = req.body;

    const result = await authService.login(email, password || senha);

    if (!result) {
      return res.status(401).json({
        error: 'Credenciais invalidas'
      });
    }

    return res.json({
      message: 'Login realizado com sucesso',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}

async function me(req, res) {
  try {
    const user =
      req.user?.id && req.user?.email
        ? {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role || 'USER',
            permissions: Array.isArray(req.user.permissions) ? req.user.permissions : []
          }
        : await authService.getCurrentUser(req.user?.id);

    if (!user) {
      return res.status(404).json({
        error: 'Usuario nao encontrado'
      });
    }

    return res.json(user);
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}

async function logout(req, res) {
  try {
    const userId = req.user?.id;

    await authService.logout(userId);

    return res.json({
      message: 'Logout realizado com sucesso'
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}

module.exports = {
  login,
  me,
  logout
};
