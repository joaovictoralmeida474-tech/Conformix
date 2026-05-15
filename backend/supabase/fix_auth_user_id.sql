-- Execute no SQL Editor do Supabase se aparecer: operator does not exist: text = uuid
-- Garante que authUserId seja TEXT (compativel com o app Node/Prisma).

ALTER TABLE public."User"
  ALTER COLUMN "authUserId" TYPE text
  USING "authUserId"::text;
