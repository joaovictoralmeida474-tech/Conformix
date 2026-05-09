const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { generateToken } = require('../utils/token');
const {
  buildAuthUser,
  getPermissionsForRole,
  resolveRoleByEmail
} = require('../utils/accessProfile');
const supabaseAuthService = require('./supabaseAuthService');

async function tryLocalLogin(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  const localUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      password: true
    }
  });

  if (!localUser?.password || localUser.password.startsWith('supabase:')) {
    return null;
  }

  const passwordValid = await bcrypt.compare(password, localUser.password);

  if (!passwordValid) {
    return null;
  }

  const role = resolveRoleByEmail(localUser.email) || 'USER';
  const safeUser = {
    id: localUser.id,
    email: localUser.email,
    role,
    permissions: getPermissionsForRole(role),
    supabaseId: null
  };

  return {
    user: safeUser,
    token: generateToken(safeUser)
  };
}

async function login(email, password) {
  if (!email || !password) {
    return null;
  }

  let authResponse;

  try {
    authResponse = await supabaseAuthService.signInWithPassword(
      email.trim().toLowerCase(),
      password
    );
  } catch (error) {
    if (error?.response?.status === 400 || error?.response?.status === 401) {
      return tryLocalLogin(email, password);
    }

    throw new Error(
      error?.response?.data?.msg ||
        error?.response?.data?.error_description ||
        error.message
    );
  }

  const supabaseUser = authResponse?.user;

  if (!supabaseUser?.email) {
    return null;
  }

  let localUser = await prisma.user.findUnique({
    where: { email: supabaseUser.email.trim().toLowerCase() },
    select: {
      id: true,
      email: true
    }
  });

  if (!localUser) {
    localUser = await prisma.user.create({
      data: {
        email: supabaseUser.email.trim().toLowerCase(),
        password: `supabase:${supabaseUser.id}`
      },
      select: {
        id: true,
        email: true
      }
    });
  }

  const safeUser = buildAuthUser({
    localUserId: localUser.id,
    supabaseUser
  });
  const token = generateToken(safeUser);

  return { user: safeUser, token };
}

async function getCurrentUser(userId) {
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: {
      id: true,
      email: true,
      password: true
    }
  });

  if (!user) {
    return null;
  }

  const supabaseId =
    typeof user.password === 'string' && user.password.startsWith('supabase:')
      ? user.password.slice('supabase:'.length)
      : null;

  return {
    id: user.id,
    email: user.email,
    role: resolveRoleByEmail(user.email) || 'USER',
    permissions: getPermissionsForRole(resolveRoleByEmail(user.email) || 'USER'),
    supabaseId
  };
}

async function logout(userId) {
  return Boolean(userId);
}

module.exports = {
  login,
  getCurrentUser,
  logout
};
