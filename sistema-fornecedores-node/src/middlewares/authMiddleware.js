const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token nao fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = String(process.env.JWT_SECRET || '').trim();

    if (!secret || secret.toUpperCase() === 'SECRET') {
      throw new Error('JWT_SECRET invalido');
    }

    const decoded = jwt.verify(token, secret);
    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido' });
  }
}

module.exports = authMiddleware;
