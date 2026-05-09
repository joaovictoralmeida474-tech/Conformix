const jwt = require('jsonwebtoken');

function generateToken(user) {
  const secret = String(process.env.JWT_SECRET || '').trim();

  if (!secret || secret.toUpperCase() === 'SECRET') {
    throw new Error('JWT_SECRET invalido');
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || []
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRE || '1d' }
  );
}

module.exports = {
  generateToken
};
