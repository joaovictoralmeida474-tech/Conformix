const fs = require('fs');

const schema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  senha     String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  auditLogs AuditLog[]

  @@map("users")
}

model Fornecedor {
  id        Int      @id @default(autoincrement())
  nome      String
  email     String
  telefone  String?
  endereco  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  avaliacoes Avaliacao[]

  @@map("fornecedores")
}

model Avaliacao {
  id           Int      @id @default(autoincrement())
  fornecedorId Int
  criterio     String
  nota         Float
  comentario   String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  fornecedor Fornecedor @relation(fields: [fornecedorId], references: [id], onDelete: Cascade)

  @@map("avaliacoes")
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  action    String
  details   String?
  ipAddress String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("audit_logs")
}
`;

fs.writeFileSync('prisma/schema.prisma', schema, 'utf8');
console.log('Prisma schema file created successfully!');
