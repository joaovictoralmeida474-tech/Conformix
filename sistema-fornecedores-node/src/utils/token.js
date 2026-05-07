const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET || 'SECRET',
    { expiresIn: process.env.JWT_EXPIRE || '1d' }
  );
}

module.exports = {
  generateToken
};
