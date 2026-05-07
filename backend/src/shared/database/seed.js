import bcrypt from "bcrypt";

import { prisma } from "./prisma.js";

export async function seedPlatform() {
  const hasCompany = await prisma.company.findFirst();

  if (!hasCompany) {
    const password = await bcrypt.hash("admin123", 10);

    await prisma.company.create({
      data: {
        name: "Empresa Demo",
        users: {
          create: {
            name: "Administrador Demo",
            email: "admin@demo.com",
            password,
            role: "ADMIN"
          }
        },
        categories: {
          create: {
            slug: "critico",
            name: "Critico",
            description: "Categoria com maior impacto operacional",
            questions: {
              create: [
                {
                  prompt: "Entrega no prazo?",
                  sortOrder: 1
                },
                {
                  prompt: "Qualidade dentro do padrao?",
                  sortOrder: 2
                }
              ]
            },
            documents: {
              create: [
                {
                  name: "ISO 9001",
                  sortOrder: 1
                },
                {
                  name: "Plano de acao",
                  sortOrder: 2
                }
              ]
            }
          }
        }
      }
    });
  }
}
