CREATE TABLE IF NOT EXISTS "Department" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "companyId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "departmentId" INTEGER,
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "User"
ALTER COLUMN "role" SET DEFAULT 'USER';

CREATE TABLE IF NOT EXISTS "Permission" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "id" SERIAL NOT NULL,
  "role" TEXT NOT NULL,
  "permissionId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Department_companyId_name_key" ON "Department"("companyId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Department_companyId_slug_key" ON "Department"("companyId", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Permission_key_key" ON "Permission"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");

DO $$
DECLARE
  company_record RECORD;
  fallback_department_id INTEGER;
BEGIN
  FOR company_record IN SELECT "id", "name" FROM "Company" LOOP
    INSERT INTO "Department" ("name", "slug", "description", "active", "companyId")
    VALUES (
      'Operacoes ' || company_record."name",
      'operacoes-' || company_record."id",
      'Departamento padrao criado pela migracao de RBAC',
      true,
      company_record."id"
    )
    ON CONFLICT ("companyId", "slug") DO NOTHING;

    SELECT "id"
    INTO fallback_department_id
    FROM "Department"
    WHERE "companyId" = company_record."id"
    ORDER BY "id" ASC
    LIMIT 1;

    UPDATE "User"
    SET "departmentId" = fallback_department_id
    WHERE "companyId" = company_record."id"
      AND "departmentId" IS NULL
      AND "role" <> 'SUPER_ADMIN';
  END LOOP;
END $$;

ALTER TABLE "Department"
ADD CONSTRAINT "Department_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User"
ADD CONSTRAINT "User_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RolePermission"
ADD CONSTRAINT "RolePermission_permissionId_fkey"
FOREIGN KEY ("permissionId") REFERENCES "Permission"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
