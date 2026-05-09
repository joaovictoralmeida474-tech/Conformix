import bcrypt from "bcrypt";

import { prisma } from "../../shared/database/prisma.js";
import { ROLES, normalizeRole } from "../../shared/auth/permissions.js";
import { signAccessToken } from "../../shared/middlewares/auth.js";
import { getUserContextById } from "../../shared/auth/userContext.js";
import { log as writeAuditLog } from "../audit/auditService.js";
import { assertStrongPassword } from "../../shared/utils/passwordPolicy.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
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
  const user = await prisma.user.findUnique({
    where: {
      email: normalizeEmail(email)
    }
  });

  if (!user) {
    throw new Error("Credenciais invalidas");
  }

  if (!user.active) {
    throw new Error("Credenciais invalidas");
  }

  const valid = await bcrypt.compare(password || "", user.password);

  if (!valid) {
    throw new Error("Credenciais invalidas");
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

  await writeAuditLog(user.id, "login", {
    entity: "auth",
    entityId: user.id,
    details: `Login realizado por ${context?.name || user.email}`
  });

  return {
    user: context,
    token: signAccessToken(context)
  };
}

export async function me(userId) {
  const user = await getUserContextById(userId);

  if (!user) {
    throw new Error("Usuario nao encontrado");
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
