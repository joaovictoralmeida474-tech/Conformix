# Integrax

## URL de producao (Vercel)

O endereco `*.vercel.app` segue o **nome do projeto** no painel da Vercel (nao vem do codigo).

Para trocar `conformix.vercel.app` por `integrax.vercel.app`:

1. Abra [vercel.com/dashboard](https://vercel.com/dashboard) e entre no projeto atual.
2. **Settings** → **General** → **Project Name** → altere para `integrax` e salve.
3. O site passa a abrir em `https://integrax.vercel.app` (faca um novo deploy se precisar).
4. No **Supabase** → **Authentication** → **URL Configuration**, atualize **Site URL** e **Redirect URLs** para `https://integrax.vercel.app` (e remova URLs antigas com `conformix` se existirem).

O backend ja aceita automaticamente o dominio atual da Vercel em CORS apos o redeploy.