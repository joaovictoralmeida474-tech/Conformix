PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL
);

INSERT INTO "new_User" ("id", "email", "password")
SELECT "id", "email", "senha"
FROM "User";

CREATE TABLE "Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "questions" TEXT NOT NULL,
    "documents" TEXT NOT NULL
);

INSERT INTO "Category" ("name", "description", "questions", "documents")
SELECT DISTINCT
    COALESCE(NULLIF("category", ''), 'Sem categoria'),
    'Migrado automaticamente',
    '[]',
    '[]'
FROM "Supplier";

CREATE TABLE "new_Supplier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "nextReview" DATETIME,
    CONSTRAINT "Supplier_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Supplier" ("id", "name", "cnpj", "categoryId", "status", "nextReview")
SELECT
    s."id",
    s."name",
    s."cnpj",
    c."id",
    s."status",
    NULL
FROM "Supplier" s
JOIN "Category" c ON c."name" = COALESCE(NULLIF(s."category", ''), 'Sem categoria');

CREATE TABLE "new_Evaluation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "supplierId" INTEGER NOT NULL,
    "evaluatorId" INTEGER NOT NULL,
    "invoiceNumber" TEXT,
    "observations" TEXT,
    "evaluationDate" DATETIME,
    "finalScore" REAL NOT NULL,
    "classification" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evaluation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Evaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Evaluation" ("id", "supplierId", "evaluatorId", "invoiceNumber", "observations", "evaluationDate", "finalScore", "classification", "createdAt")
SELECT "id", "supplierId", "evaluatorId", "invoiceNumber", "observations", "evaluationDate", "finalScore", "classification", "createdAt"
FROM "Evaluation";

CREATE TABLE "new_RNC" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "supplierId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "RNC_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_RNC" ("id", "supplierId", "description", "status")
SELECT "id", "supplierId", "description", "status"
FROM "RNC";

DROP TABLE "Log";
DROP TABLE "Evaluation";
DROP TABLE "RNC";
DROP TABLE "Supplier";
DROP TABLE "User";

ALTER TABLE "new_User" RENAME TO "User";
ALTER TABLE "new_Supplier" RENAME TO "Supplier";
ALTER TABLE "new_Evaluation" RENAME TO "Evaluation";
ALTER TABLE "new_RNC" RENAME TO "RNC";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
