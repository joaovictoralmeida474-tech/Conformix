const PAGE_HEADINGS = [
  {
    match: (path) => path.startsWith("/dashboard"),
    title: "Dashboard",
    description: "Visão geral e indicadores do programa de homologação"
  },
  {
    match: (path) => path.startsWith("/suppliers"),
    title: "Fornecedores",
    description: "Gestão e avaliação de fornecedores cadastrados"
  },
  {
    match: (path) => path.startsWith("/categories"),
    title: "Categorias",
    description: "Questionários, documentos e regras por categoria de fornecedor"
  },
  {
    match: (path) => path.startsWith("/rnc"),
    title: "RNC",
    description: "Registro e tratativa de não conformidades"
  },
  {
    match: (path) => path.startsWith("/audit"),
    title: "Auditoria",
    description: "Histórico de ações e rastreabilidade no sistema"
  },
  {
    match: (path) => path === "/admin/usuarios",
    title: "Usuários",
    description: "Gestão de usuários e permissões de acesso"
  },
  {
    match: (path) => path === "/admin/admins",
    title: "Administradores",
    description: "Contas administrativas e perfis de governança"
  },
  {
    match: (path) => path === "/admin/departamentos",
    title: "Departamentos",
    description: "Estrutura organizacional e vínculos de equipe"
  },
  {
    match: (path) => path === "/admin/configuracoes",
    title: "Configurações",
    description: "Parâmetros gerais e preferências da plataforma"
  },
  {
    match: (path) => path.startsWith("/admin"),
    title: "Admin",
    description: "Painel administrativo e governança da plataforma"
  }
];

const DEFAULT_HEADING = {
  title: "Integraxx",
  description: "Sistema de avaliação de fornecedores"
};

export function getPageHeading(pathname = "/") {
  const path = String(pathname || "/");
  const found = PAGE_HEADINGS.find((entry) => entry.match(path));
  return found || DEFAULT_HEADING;
}
