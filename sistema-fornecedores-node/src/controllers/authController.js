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
  logout
};
