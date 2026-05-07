import jwt from "jsonwebtoken";

import { prisma } from "../database/prisma.js";

function extractToken(authorization = "") {
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7);
  }

  return authorization || null;
}

function mapLocalUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    authUserId: user.authUserId || null
  };
}

async function resolveSupabaseUser(accessToken) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseApiKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseApiKey) {
    return null;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseApiKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function resolveLocalUserFromSupabase(accessToken) {
  const authUser = await resolveSupabaseUser(accessToken);

  if (!authUser?.id || !authUser?.email) {
    return null;
  }

  const normalizedEmail = String(authUser.email).trim().toLowerCase();

  let user = await prisma.user.findUnique({
    where: {
      authUserId: authUser.id
    }
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail
      }
    });

    if (user && user.authUserId !== authUser.id) {
      user = await prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          authUserId: authUser.id
        }
      });
    }
  }

  if (!user || !user.active) {
    return null;
  }

  return mapLocalUser(user);
}

export async function auth(req, res, next) {
  const token = extractToken(req.headers.authorization) || req.query.token || null;

  if (!token) {
    return res.status(401).json({ error: "Token nao informado" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "SECRET");
    req.user = decoded;
    return next();
  } catch {
    try {
      const user = await resolveLocalUserFromSupabase(token);

      if (!user) {
        return res.status(403).json({
          error: "Token invalido ou usuario nao vinculado ao sistema"
        });
      }

      req.user = user;
      return next();
    } catch {
      return res.status(403).json({ error: "Token invalido" });
    }
  }
}

export function isAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.sendStatus(403);
  }

  next();
}
