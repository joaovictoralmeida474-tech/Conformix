const bcrypt = require('bcrypt');

const prisma = require('../lib/prisma');
const { generateToken } = require('../utils/token');

async function login(email, password) {
  if (!email || !password) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      email: true,
      password: true
    }
  });

  if (!user) {
    return null;
  }

  const passwordValid = await bcrypt.compare(password, user.password);

  if (!passwordValid) {
    return null;
  }

  const token = generateToken(user);
  const { password: _, ...safeUser } = user;

  return { user: safeUser, token };
}

async function logout(userId) {
  return Boolean(userId);
}

module.exports = {
  login,
  logout
};
