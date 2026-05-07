import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { prisma } from "../../shared/database/prisma.js";

function normalizeEmail(email) {
  return email?.trim().toLowerCase();
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      companyId: user.companyId
    },
    process.env.JWT_SECRET || "SECRET",
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

function getSupabaseAdminConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no backend para registrar usuarios"
    );
  }

  return { supabaseUrl, serviceRoleKey };
}

async function createSupabaseUser({ email, password, name, role }) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name?.trim() || "Administrador",
        role
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.msg || payload?.message || "Falha ao criar usuario no Supabase");
  }

  return payload;
}

async function deleteSupabaseUser(authUserId) {
  if (!authUserId) return;

  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();

  await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });
}

export async function register({ email, password, role, companyName, companyId, name }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new Error("Email e senha sao obrigatorios");
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existing) {
    throw new Error("Email ja cadastrado");
  }

  const hash = await bcrypt.hash(password, 10);
  const normalizedRole = (role || "ADMIN").toUpperCase();
  const normalizedName = String(name || "").trim() || "Administrador";
  const authUser = await createSupabaseUser({
    email: normalizedEmail,
    password,
    name: normalizedName,
    role: normalizedRole
  });

  try {
    if (companyId) {
      const user = await prisma.user.create({
        data: {
          name: normalizedName,
          email: normalizedEmail,
          password: hash,
          role: normalizedRole,
          companyId: Number(companyId),
          authUserId: authUser.id
        }
      });

      return {
        user,
        token: signToken(user)
      };
    }

    const company = await prisma.company.create({
      data: {
        name: companyName?.trim() || "Nova Empresa",
        users: {
          create: {
            name: normalizedName,
            email: normalizedEmail,
            password: hash,
            role: normalizedRole,
            authUserId: authUser.id
          }
        }
      },
      include: {
        users: true
      }
    });

    const user = company.users[0];

    return {
      user,
      token: signToken(user)
    };
  } catch (error) {
    await deleteSupabaseUser(authUser.id).catch(() => null);
    throw error;
  }
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) }
  });

  if (!user) {
    throw new Error("Usuario nao encontrado");
  }

  const valid = await bcrypt.compare(password || "", user.password);

  if (!valid) {
    throw new Error("Senha invalida");
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId
    },
    token: signToken(user)
  };
}
