import { getSupabaseAdmin, throwIfSupabaseError } from "./supabaseStore.js";

export function client() {
  return getSupabaseAdmin();
}

export async function countRows(table, filters = {}) {
  let query = client().from(table).select("id", { count: "exact", head: true });

  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }

  const result = await query;
  if (result.error) {
    return 0;
  }

  return result.count || 0;
}

export async function findById(table, id) {
  return throwIfSupabaseError(
    await client().from(table).select("*").eq("id", Number(id)).maybeSingle(),
    `buscar ${table}`
  );
}

export async function findOne(table, filters = {}) {
  let query = client().from(table).select("*");

  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }

  return throwIfSupabaseError(await query.maybeSingle(), `buscar ${table}`);
}

export async function findMany(table, filters = {}, options = {}) {
  let query = client().from(table).select(options.select || "*");

  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }

  if (options.orderBy) {
    for (const [column, ascending] of Object.entries(options.orderBy)) {
      query = query.order(column, { ascending: ascending !== false });
    }
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  return throwIfSupabaseError(await query, `listar ${table}`);
}

export async function insertRow(table, data, options = {}) {
  let query = client().from(table).insert(data);

  if (options.select) {
    query = query.select(options.select);
  } else {
    query = query.select("*");
  }

  if (options.single !== false) {
    query = query.single();
  }

  return throwIfSupabaseError(await query, `criar ${table}`);
}

export async function updateRow(table, id, data, options = {}) {
  let query = client().from(table).update(data).eq("id", Number(id));

  if (options.select) {
    query = query.select(options.select);
  } else {
    query = query.select("*");
  }

  return throwIfSupabaseError(await query.single(), `atualizar ${table}`);
}

export async function deleteRow(table, id) {
  return throwIfSupabaseError(
    await client().from(table).delete().eq("id", Number(id)),
    `excluir ${table}`
  );
}

export async function deleteWhere(table, filters = {}) {
  let query = client().from(table).delete();

  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }

  return throwIfSupabaseError(await query, `excluir registros de ${table}`);
}
