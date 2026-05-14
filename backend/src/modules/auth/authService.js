import bcrypt from "bcrypt";

import { prisma } from "../../shared/database/prisma.js";
import { ROLES, normalizeRole } from "../../shared/auth/permissions.js";
import { signAccessToken } from "../../shared/middlewares/auth.js";
import { getUserContextById } from "../../shared/auth/userContext.js";
import { log as writeAuditLog } from "../audit/auditService.js";
import { assertStrongPassword } from "../../shared/utils/passwordPolicy.js";
import { signInWithPassword as signInWithSupabase } from "./supabaseAuthService.js";
import {
  buildSupabaseProfile,
  ensureSupabaseProvisioningScope
} from "../../shared/auth/supabaseProvisioning.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizePasswordCandidates(password) {
  const raw = String(password || "");
  const trimmed = raw.trim();
  return [...new Set([raw, trimmed].filter(Boolean))];
}

function getSuperAdminAliases() {
  const configured = normalizeEmail(process.env.SUPER_ADMIN_EMAIL);
  return new Set(["superadmin@conformix.local", configured].filter(Boolean));
}

function getAuthEmailCandidates(email) {
  const normalizedEmail = normalizeEmail(email);
  const aliases = getSuperAdminAliases();

  if (!aliases.has(normalizedEmail)) {
    return [normalizedEmail];
  }

  return [...new Set([normalizedEmail, ...aliases])];
}

function createAuthError(message = "Falha na autenticacao") {
  const error = new Error(message);
  error.code = "AUTH_INVALID_CREDENTIALS";
  return error;
}

function createInactiveUserError() {
  const error = new Error("Usuario inativo");
  error.code = "AUTH_USER_INACTIVE";
  return error;
}

async function writeAuditLogSafely(userId, action, meta = {}) {
  try {
    await writeAuditLog(userId, action, meta);
  } catch (error) {
    console.error("Aviso: falha ao registrar auditoria de autenticacao:", error?.message || error);
  }
}

function buildProvisioningProfile(supabaseUser) {
  return buildSupabaseProfile(supabaseUser);
}

async function syncSupabaseUserToLocal({ existingUser, supabaseUser, password }) {
  if (existingUser && existingUser.active === false) {
    throw createInactiveUserError();
  }

  const profile = buildProvisioningProfile(supabaseUser);
  const targetRole = normalizeRole(existingUser?.role || profile.role || ROLES.USER);
  const targetName =
    String(existingUser?.name || profile.name || "").trim() ||
    "Usuario";
  const scope = await ensureSupabaseProvisioningScope({
    ...profile,
    role: targetRole,
    companyId: existingUser?.companyId || profile.companyId,
    departmentId:
      targetRole === ROLES.SUPER_ADMIN
        ? null
        : existingUser?.departmentId || profile.departmentId
  });

  const data = {
    name: targetName,
    email: normalizeEmail(supabaseUser.email),
    password: await bcrypt.hash(password, 10),
    role: targetRole,
    active: existingUser ? existingUser.active !== false : true,
    companyId: scope.companyId,
    departmentId: scope.departmentId,
    authUserId: supabaseUser.id,
    lastLoginAt: new Date()
  };

  if (!existingUser) {
    return prisma.user.create({ data });
  }

  return prisma.user.update({
    where: {
      id: existingUser.id
    },
    data
  });
}

async function provisionUserFromSupabase({ supabaseUser, password }) {
  return syncSupabaseUserToLocal({
    existingUser: null,
    supabaseUser,
    password
  });
}

function isSupabaseUnavailableError(error) {
  return (
    Number(error?.response?.status) >= 500 ||
    error?.code === "ECONNREFUSED" ||
    error?.code === "ENOTFOUND" ||
    error?.code === "ETIMEDOUT" ||
    error?.code === "ECONNABORTED" ||
    /SUPABASE_URL ou SUPABASE_ANON_KEY nao configurados/i.test(error?.message || "")
  );
}

async function ensureDepartmentForRole({ companyId, departmentId, role }) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === ROLES.SUPER_ADMIN) {
    return null;
  }

  if (!departmentId) {
    throw new Error("Departamento obrigatorio para ADMIN e USER");
  }

  const department = await prisma.department.findFirst({
    where: {
      id: Number(departmentId),
      companyId: Number(companyId),
      active: true
    }
  });

  if (!department) {
    throw new Error("Departamento nao encontrado");
  }

  return department.id;
}

async function createUserRecord({ email, password, role, companyId, departmentId, name, active = true }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new Error("Email e senha sao obrigatorios");
  }

  assertStrongPassword(password);

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existing) {
    throw new Error("Email ja cadastrado");
  }

  const normalizedRole = normalizeRole(role);
  const hash = await bcrypt.hash(password, 10);
  const normalizedName = String(name || "").trim() || "Usuario";
  const resolvedDepartmentId = await ensureDepartmentForRole({
    companyId,
    departmentId,
    role: normalizedRole
  });

  const user = await prisma.user.create({
    data: {
      name: normalizedName,
      email: normalizedEmail,
      password: hash,
      role: normalizedRole,
      active: Boolean(active),
      companyId: Number(companyId),
      departmentId: resolvedDepartmentId
    }
  });

  return getUserContextById(user.id);
}

export async function register({ email, password, role, companyName, companyId, departmentId, name }) {
  const requestedRole = normalizeRole(role || ROLES.ADMIN);

  if (requestedRole !== ROLES.ADMIN) {
    throw new Error("Cadastro publico permite apenas contas administrativas da propria empresa");
  }

  if (companyId) {
    throw new Error("Cadastro publico nao pode vincular usuarios a empresas existentes");
  }

  const normalizedCompanyName = String(companyName || "").trim() || "Nova Empresa";
  const normalizedName = String(name || "").trim() || "Administrador";
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new Error("Email e senha sao obrigatorios");
  }

  assertStrongPassword(password);

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existing) {
    throw new Error("Email ja cadastrado");
  }

  const hash = await bcrypt.hash(password, 10);

  const company = await prisma.company.create({
    data: {
      name: normalizedCompanyName,
      departments: {
        create: {
          name: "Operacoes",
          slug: "operacoes",
          description: "Departamento inicial da empresa"
        }
      }
    },
    include: {
      departments: true
    }
  });

  const department = company.departments[0];
  const user = await prisma.user.create({
    data: {
      name: normalizedName,
      email: normalizedEmail,
      password: hash,
      role: requestedRole,
      companyId: company.id,
      departmentId: department?.id || null
    }
  });

  const context = await getUserContextById(user.id);

  return {
    user: context,
    token: signAccessToken(context)
  };
}

export async function login({ email, password }) {
  const emailCandidates = getAuthEmailCandidates(email);
  const passwordCandidates = normalizePasswordCandidates(password);
  let supabaseUnavailable = false;

  for (const currentEmail of emailCandidates) {
    const user = await prisma.user.findUnique({
      where: {
        email: currentEmail
      }
    });

    if (!user) {
      continue;
    }

    if (!user.active) {
      throw createInactiveUserError();
    }

    for (const currentPassword of passwordCandidates) {
      const valid = await bcrypt.compare(currentPassword, user.password);

      if (!valid) {
        continue;
      }

      await prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          lastLoginAt: new Date()
        }
      });

      const context = await getUserContextById(user.id);

      await writeAuditLogSafely(user.id, "login", {
        entity: "auth",
        entityId: user.id,
        details: `Login realizado por ${context?.name || user.email}`
      });

      return {
        user: context,
        token: signAccessToken(context)
      };
    }
  }

  for (const currentEmail of emailCandidates) {
    for (const currentPassword of passwordCandidates) {
      try {
        const authResponse = await signInWithSupabase(currentEmail, currentPassword);
        const supabaseUser = authResponse?.user;

        if (!supabaseUser?.email) {
          continue;
        }

        const normalizedSupabaseEmail = normalizeEmail(supabaseUser.email);
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { authUserId: supabaseUser.id },
              { email: normalizedSupabaseEmail }
            ]
          }
        });

        if (!user) {
          user = await provisionUserFromSupabase({
            supabaseUser,
            password: currentPassword
          });
        } else {
          if (user.active === false) {
            throw createInactiveUserError();
          }

          user = await syncSupabaseUserToLocal({
            existingUser: user,
            supabaseUser,
            password: currentPassword
          });
        }

        const context = await getUserContextById(user.id);

        await writeAuditLogSafely(user.id, "login", {
          entity: "auth",
          entityId: user.id,
          details: `Login realizado por ${context?.name || normalizedSupabaseEmail}`
        });

        return {
          user: context,
          token: signAccessToken(context)
        };
      } catch (error) {
        if (isSupabaseUnavailableError(error)) {
          supabaseUnavailable = true;
          continue;
        }

        if (error?.response?.status === 400 || error?.response?.status === 401) {
          continue;
        }

        if (error?.code === "AUTH_USER_INACTIVE") {
          throw error;
        }

        if (error?.code === "AUTH_INVALID_CREDENTIALS") {
          continue;
        }

        throw error;
      }
    }
  }

  if (supabaseUnavailable) {
    throw createAuthError("Servico de autenticacao temporariamente indisponivel");
  }

  throw createAuthError();
}

export async function me(userId) {
  const user = await getUserContextById(userId);

  if (!user) {
    throw createAuthError("Usuario nao autenticado");
  }

  return user;
}

export async function updatePassword(userId, password) {
  if (!password) {
    throw new Error("Senha obrigatoria");
  }

  assertStrongPassword(password);

  const hash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: {
      id: Number(userId)
    },
    data: {
      password: hash
    }
  });
}
