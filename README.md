# Integraxx

## URL de producao (Vercel)

URL oficial: **`https://integrax.vercel.app`**

Ao renomear o projeto na Vercel, a URL antiga (`conformix.vercel.app`) pode continuar funcionando como alias. Isso e normal.

1. Use e compartilhe sempre **`https://integrax.vercel.app`**.
2. Faca um **deploy** apos alterar o `vercel.json` (redirect automatico do dominio antigo para o novo).
3. No **Supabase** → **Authentication** → **URL Configuration**, defina **Site URL** = `https://integrax.vercel.app` e inclua `https://integrax.vercel.app/**` em **Redirect URLs**.
4. Opcional na Vercel: **Settings** → **Domains** e confira se `integrax.vercel.app` esta como dominio de producao.

O backend aceita automaticamente o dominio atual da Vercel em CORS.