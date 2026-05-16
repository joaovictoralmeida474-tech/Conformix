import axios from "axios";

import { normalizeRole, ROLES } from "../auth/permissions.js";
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl
} from "../config/supabaseEnv.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getSupabaseAdminConfig() {
  const url = getSupabaseUrl();
  const apiKey = getSupabaseServiceRoleKey() || getSupabaseAnonKey();

  if (!url || !apiKey) {
    throw new Error("SUPABASE_URL ou SUPABASE_ANON_KEY nao configurados");
  }

  return {
    url,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  };
}

function buildSupabasePayload({
  email,
  password,
  name,
  role,
  companyId,
  departmentId,
  active
}) {
  const normalizedRole = normalizeRole(role);
  const payload = {
    email: normalizeEmail(email),
    email_confirm: true,
    user_metadata: {
      name: String(name || "").trim() || "Usuario",
      companyId: companyId ? Number(companyId) : null,
      departmentId: departmentId ? Number(departmentId) : null
    },
    app_metadata: {
      role: normalizedRole,
      companyId: companyId ? Number(companyId) : null,
      departmentId: departmentId ? Number(departmentId) : null
    }
  };

  if (password) {
    payload.password = String(password);
  }

  if (active === false) {
    payload.ban_duration = "none";
  }

  if (active === true) {
    payload.ban_duration = "0s";
  }

  if (normalizedRole === ROLES.SUPER_ADMIN) {
    payload.user_metadata.departmentId = null;
    payload.app_metadata.departmentId = null;
  }

  return payload;
}

export async function listSupabaseUsers() {
  const { url, headers } = getSupabaseAdminConfig();
  const response = await axios.get(`${url}/auth/v1/admin/users`, {
    proxy: false,
    headers
  });

  return Array.isArray(response.data?.users) ? response.data.users : [];
}

export async function findSupabaseUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const users = await listSupabaseUsers();
  return (
    users.find((item) => normalizeEmail(item?.email) === normalizedEmail) ||
    null
  );
}

export async function upsertSupabaseUser({
  email,
  password,
  name,
  role,
  companyId,
  departmentId,
  active
}) {
  const { url, headers } = getSupabaseAdminConfig();
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await findSupabaseUserByEmail(normalizedEmail);
  const payload = buildSupabasePayload({
    email: normalizedEmail,
    password,
    name,
    role,
    companyId,
    departmentId,
    active
  });

  if (!existingUser?.id) {
    if (!password) {
      throw new Error("Senha obrigatoria para criar usuario no Supabase");
    }

    const response = await axios.post(`${url}/auth/v1/admin/users`, payload, {
      proxy: false,
      headers
    });

    return response.data?.user || response.data || null;
  }

  const response = await axios.put(`${url}/auth/v1/admin/users/${existingUser.id}`, payload, {
    proxy: false,
    headers
  });

  return response.data?.user || response.data || existingUser;
}

export async function updateSupabaseUserPassword(userId, password) {
  const { url, headers } = getSupabaseAdminConfig();
  const response = await axios.put(
    `${url}/auth/v1/admin/users/${userId}`,
    {
      password: String(password || "")
    },
    {
      proxy: false,
      headers
    }
  );

  return response.data?.user || response.data || null;
}

export async function deleteSupabaseUser(userId) {
  const { url, headers } = getSupabaseAdminConfig();
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    return false;
  }

  try {
    await axios.delete(`${url}/auth/v1/admin/users/${normalizedUserId}`, {
      proxy: false,
      headers
    });

    return true;
  } catch (error) {
    if (error?.response?.status === 404) {
      return false;
    }

    throw error;
  }
}
