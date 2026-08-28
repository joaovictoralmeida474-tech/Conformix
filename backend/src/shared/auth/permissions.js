export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  USER: "USER"
};

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  SUPPLIERS_VIEW: "suppliers:view",
  SUPPLIERS_MANAGE: "suppliers:manage",
  SUPPLIERS_EVALUATE: "suppliers:evaluate",
  SUPPLIERS_EXPORT: "suppliers:export",
  CATEGORIES_VIEW: "categories:view",
  CATEGORIES_MANAGE: "categories:manage",
  RNC_VIEW: "rnc:view",
  RNC_MANAGE: "rnc:manage",
  NFS_VIEW: "nfs:view",
  NFS_MANAGE: "nfs:manage",
  AUDIT_VIEW: "audit:view",
  ADMIN_ACCESS: "admin:access",
  ADMIN_DASHBOARD_VIEW: "admin:dashboard:view",
  USERS_VIEW: "users:view",
  USERS_MANAGE: "users:manage",
  ADMINS_VIEW: "admins:view",
  ADMINS_MANAGE: "admins:manage",
  DEPARTMENTS_VIEW: "departments:view",
  DEPARTMENTS_MANAGE: "departments:manage",
  SETTINGS_VIEW: "settings:view",
  SYSTEM_LOGS_VIEW: "system_logs:view"
};

export const PERMISSION_DEFINITIONS = [
  {
    key: PERMISSIONS.DASHBOARD_VIEW,
    name: "Visualizar dashboard operacional",
    description: "Permite acessar o dashboard principal da operacao."
  },
  {
    key: PERMISSIONS.SUPPLIERS_VIEW,
    name: "Visualizar fornecedores",
    description: "Permite consultar a base de fornecedores."
  },
  {
    key: PERMISSIONS.SUPPLIERS_MANAGE,
    name: "Gerenciar fornecedores",
    description: "Permite criar, editar e excluir fornecedores."
  },
  {
    key: PERMISSIONS.SUPPLIERS_EVALUATE,
    name: "Avaliar fornecedores",
    description: "Permite registrar avaliacoes e documentos de fornecedores."
  },
  {
    key: PERMISSIONS.SUPPLIERS_EXPORT,
    name: "Exportar fornecedores",
    description: "Permite exportar os dados de fornecedores."
  },
  {
    key: PERMISSIONS.CATEGORIES_VIEW,
    name: "Visualizar categorias",
    description: "Permite consultar categorias de fornecedores."
  },
  {
    key: PERMISSIONS.CATEGORIES_MANAGE,
    name: "Gerenciar categorias",
    description: "Permite criar, editar e excluir categorias."
  },
  {
    key: PERMISSIONS.RNC_VIEW,
    name: "Visualizar RNCs",
    description: "Permite consultar RNCs do sistema."
  },
  {
    key: PERMISSIONS.RNC_MANAGE,
    name: "Gerenciar RNCs",
    description: "Permite tratar e atualizar RNCs."
  },
  {
    key: PERMISSIONS.NFS_VIEW,
    name: "Visualizar notas fiscais",
    description: "Permite consultar notas fiscais de servicos."
  },
  {
    key: PERMISSIONS.NFS_MANAGE,
    name: "Gerenciar notas fiscais",
    description: "Permite cadastrar, editar e anexar documentos em notas fiscais."
  },
  {
    key: PERMISSIONS.AUDIT_VIEW,
    name: "Visualizar auditoria",
    description: "Permite acessar a trilha de auditoria."
  },
  {
    key: PERMISSIONS.ADMIN_ACCESS,
    name: "Acessar painel administrativo",
    description: "Permite acessar as rotas administrativas."
  },
  {
    key: PERMISSIONS.ADMIN_DASHBOARD_VIEW,
    name: "Visualizar dashboard administrativo",
    description: "Permite visualizar o dashboard administrativo."
  },
  {
    key: PERMISSIONS.USERS_VIEW,
    name: "Visualizar usuarios",
    description: "Permite listar usuarios conforme o escopo permitido."
  },
  {
    key: PERMISSIONS.USERS_MANAGE,
    name: "Gerenciar usuarios",
    description: "Permite criar, editar, excluir e resetar senha de usuarios."
  },
  {
    key: PERMISSIONS.ADMINS_VIEW,
    name: "Visualizar admins",
    description: "Permite listar administradores do sistema."
  },
  {
    key: PERMISSIONS.ADMINS_MANAGE,
    name: "Gerenciar admins",
    description: "Permite criar, editar, ativar, desativar e remover admins."
  },
  {
    key: PERMISSIONS.DEPARTMENTS_VIEW,
    name: "Visualizar departamentos",
    description: "Permite consultar departamentos e empresas."
  },
  {
    key: PERMISSIONS.DEPARTMENTS_MANAGE,
    name: "Gerenciar departamentos",
    description: "Permite criar, editar e excluir departamentos."
  },
  {
    key: PERMISSIONS.SETTINGS_VIEW,
    name: "Visualizar configuracoes globais",
    description: "Permite acessar configuracoes administrativas globais."
  },
  {
    key: PERMISSIONS.SYSTEM_LOGS_VIEW,
    name: "Visualizar logs do sistema",
    description: "Permite consultar logs administrativos basicos."
  }
];

export const ROLE_PERMISSION_MAP = {
  [ROLES.SUPER_ADMIN]: PERMISSION_DEFINITIONS.map((item) => item.key),
  [ROLES.ADMIN]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.SUPPLIERS_MANAGE,
    PERMISSIONS.SUPPLIERS_EVALUATE,
    PERMISSIONS.SUPPLIERS_EXPORT,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.RNC_VIEW,
    PERMISSIONS.RNC_MANAGE,
    PERMISSIONS.NFS_VIEW,
    PERMISSIONS.NFS_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.ADMIN_DASHBOARD_VIEW,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE
  ],
  [ROLES.USER]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.RNC_VIEW,
    PERMISSIONS.NFS_VIEW
  ]
};

export function normalizeRole(role) {
  const normalized = String(role || "").trim().toUpperCase();

  if (normalized === ROLES.SUPER_ADMIN) return ROLES.SUPER_ADMIN;
  if (normalized === ROLES.ADMIN) return ROLES.ADMIN;
  return ROLES.USER;
}

export function hasPermission(user, permission) {
  if (!permission) return true;
  if (normalizeRole(user?.role) === ROLES.SUPER_ADMIN) return true;
  if (!user?.permissions?.length) return false;
  return user.permissions.includes(permission);
}

export function isAdminRole(role) {
  const normalized = normalizeRole(role);
  return normalized === ROLES.SUPER_ADMIN || normalized === ROLES.ADMIN;
}
