DO $$
DECLARE
  platform_company_id INTEGER;
  platform_department_id INTEGER;
  super_admin_id INTEGER;
BEGIN
  SELECT "id" INTO platform_company_id
  FROM "Company"
  WHERE "name" = 'Integrax Platform'
  ORDER BY "id" ASC
  LIMIT 1;

  IF platform_company_id IS NULL THEN
    INSERT INTO "Company" ("name")
    VALUES ('Integrax Platform')
    RETURNING "id" INTO platform_company_id;
  END IF;

  SELECT "id" INTO platform_department_id
  FROM "Department"
  WHERE "companyId" = platform_company_id AND "slug" = 'administracao-global'
  LIMIT 1;

  IF platform_department_id IS NULL THEN
    INSERT INTO "Department" ("name", "slug", "description", "companyId", "active", "createdAt", "updatedAt")
    VALUES (
      'Administracao Global',
      'administracao-global',
      'Departamento reservado ao SUPER_ADMIN da plataforma',
      platform_company_id,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING "id" INTO platform_department_id;
  END IF;

  INSERT INTO "Permission" ("key", "name", "description") VALUES
    ('dashboard:view', 'Visualizar dashboard operacional', 'Permite acessar o dashboard principal da operacao.'),
    ('suppliers:view', 'Visualizar fornecedores', 'Permite consultar a base de fornecedores.'),
    ('suppliers:manage', 'Gerenciar fornecedores', 'Permite criar, editar e excluir fornecedores.'),
    ('suppliers:evaluate', 'Avaliar fornecedores', 'Permite registrar avaliacoes e documentos de fornecedores.'),
    ('suppliers:export', 'Exportar fornecedores', 'Permite exportar os dados de fornecedores.'),
    ('categories:view', 'Visualizar categorias', 'Permite consultar categorias de fornecedores.'),
    ('categories:manage', 'Gerenciar categorias', 'Permite criar, editar e excluir categorias.'),
    ('rnc:view', 'Visualizar RNCs', 'Permite consultar RNCs do sistema.'),
    ('rnc:manage', 'Gerenciar RNCs', 'Permite tratar e atualizar RNCs.'),
    ('audit:view', 'Visualizar auditoria', 'Permite acessar a trilha de auditoria.'),
    ('admin:access', 'Acessar painel administrativo', 'Permite acessar as rotas administrativas.'),
    ('admin:dashboard:view', 'Visualizar dashboard administrativo', 'Permite visualizar o dashboard administrativo.'),
    ('users:view', 'Visualizar usuarios', 'Permite listar usuarios conforme o escopo permitido.'),
    ('users:manage', 'Gerenciar usuarios', 'Permite criar, editar, excluir e resetar senha de usuarios.'),
    ('admins:view', 'Visualizar admins', 'Permite listar administradores do sistema.'),
    ('admins:manage', 'Gerenciar admins', 'Permite criar, editar, ativar, desativar e remover admins.'),
    ('departments:view', 'Visualizar departamentos', 'Permite consultar departamentos e empresas.'),
    ('departments:manage', 'Gerenciar departamentos', 'Permite criar, editar e excluir departamentos.'),
    ('settings:view', 'Visualizar configuracoes globais', 'Permite acessar configuracoes administrativas globais.'),
    ('system_logs:view', 'Visualizar logs do sistema', 'Permite consultar logs administrativos basicos.')
  ON CONFLICT ("key") DO NOTHING;

  INSERT INTO "RolePermission" ("role", "permissionId")
  SELECT 'SUPER_ADMIN', p."id"
  FROM "Permission" p
  ON CONFLICT ("role", "permissionId") DO NOTHING;

  INSERT INTO "RolePermission" ("role", "permissionId")
  SELECT 'ADMIN', p."id"
  FROM "Permission" p
  WHERE p."key" IN (
    'dashboard:view', 'suppliers:view', 'suppliers:manage', 'suppliers:evaluate', 'suppliers:export',
    'categories:view', 'categories:manage', 'rnc:view', 'rnc:manage', 'audit:view',
    'admin:access', 'admin:dashboard:view', 'users:view', 'users:manage'
  )
  ON CONFLICT ("role", "permissionId") DO NOTHING;

  INSERT INTO "RolePermission" ("role", "permissionId")
  SELECT 'USER', p."id"
  FROM "Permission" p
  WHERE p."key" IN ('dashboard:view', 'suppliers:view', 'rnc:view')
  ON CONFLICT ("role", "permissionId") DO NOTHING;

  SELECT "id" INTO super_admin_id
  FROM "User"
  WHERE "email" = 'superadmin@conformix.local'
  LIMIT 1;

  IF super_admin_id IS NULL THEN
    INSERT INTO "User" (
      "name", "email", "password", "role", "active", "companyId", "departmentId", "createdAt", "updatedAt"
    )
    VALUES (
      'Super Admin',
      'superadmin@conformix.local',
      '$2b$10$zjPFE9QwPNHvqcnUZNymQ.KB9CBbGXOXaaCAF1hMrd.0YOoEcmpzO',
      'SUPER_ADMIN',
      true,
      platform_company_id,
      platform_department_id,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  ELSE
    UPDATE "User"
    SET
      "name" = 'Super Admin',
      "role" = 'SUPER_ADMIN',
      "active" = true,
      "companyId" = platform_company_id,
      "departmentId" = platform_department_id,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = super_admin_id;
  END IF;
END $$;
