# Integraxx

## URL de producao (Vercel)

URL oficial: **`https://integraxx.vercel.app`**

Dominios antigos (`conformix.vercel.app`, `integrax.vercel.app`) redirecionam automaticamente apos o deploy.

1. Renomeie o projeto na Vercel para **`integraxx`** (Settings → General → Project Name).
2. Faca **deploy** deste repositorio.
3. No **Supabase** → **Authentication** → **URL Configuration**:
   - Site URL: `https://integraxx.vercel.app`
   - Redirect URLs: `https://integraxx.vercel.app/**`

O backend aceita automaticamente o dominio atual da Vercel em CORS.
