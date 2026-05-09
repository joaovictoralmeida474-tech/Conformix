const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { generateToken } = require('../utils/token');
const {
  buildAuthUser,
  getPermissionsForRole,
  resolveRoleByEmail
} = require('../utils/accessProfile');
const supabaseAuthService = require('./supabaseAuthService');

function parseConfiguredEmails(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getAuthEmailCandidates(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const bootstrapEmail = String(process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const superAdminAliases = new Set([
    'superadmin@conformix.local',
    ...parseConfiguredEmails(process.env.SUPER_ADMIN_EMAILS),
    ...parseConfiguredEmails(process.env.ADMIN_EMAILS)
  ]);

  const candidates = [];

  if (superAdminAliases.has(normalizedEmail) && bootstrapEmail) {
    candidates.push(bootstrapEmail);
  }

  candidates.push(normalizedEmail);

  return [...new Set(candidates.filter(Boolean))];
}

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

async function tryLocalLoginCandidates(emailCandidates, password) {
  for (const candidate of emailCandidates) {
    const result = await tryLocalLogin(candidate, password);

    if (result) {
      return result;
    }
  }

  return null;
}

async function login(email, password) {
  if (!email || !password) {
    return null;
  }

  const emailCandidates = getAuthEmailCandidates(email);

  for (const authEmail of emailCandidates) {
    try {
      const authResponse = await supabaseAuthService.signInWithPassword(
        authEmail,
        password
      );

      const supabaseUser = authResponse?.user;

      if (!supabaseUser?.email) {
        continue;
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
    } catch (error) {
      if (
        error?.code === 'ECONNREFUSED' ||
        error?.code === 'ENOTFOUND' ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'ECONNABORTED' ||
        /SUPABASE_URL ou SUPABASE_ANON_KEY nao configurados/i.test(error?.message || '')
      ) {
        return tryLocalLoginCandidates(emailCandidates, password);
      }

      if (error?.response?.status === 400 || error?.response?.status === 401) {
        continue;
      }

      throw new Error(
        error?.response?.data?.msg ||
          error?.response?.data?.error_description ||
          error.message
      );
    }
  }

  return tryLocalLoginCandidates(emailCandidates, password);
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
