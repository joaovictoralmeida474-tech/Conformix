import { spawn } from "node:child_process";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });

    child.on("error", reject);
  });
}

function hasDatabaseUrl() {
  const keys = [
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING"
  ];

  return keys.some((key) => /^postgres(ql)?:\/\//i.test(String(process.env[key] || "").trim()));
}

await run("npm", ["--prefix", "backend", "run", "prisma:generate"]);

if (hasDatabaseUrl()) {
  console.log("DATABASE_URL detectada. Aplicando prisma db push no ambiente de build.");
  try {
    await run("npm", ["--prefix", "backend", "run", "prisma:deploy"]);
  } catch (error) {
    console.warn(
      "Aviso: prisma db push falhou durante o build e sera ignorado para nao bloquear o deploy."
    );
    console.warn(error?.message || error);
  }
} else {
  console.warn("DATABASE_URL ausente. Pulando prisma db push neste build.");
}

await run("npm", ["--prefix", "frontend", "run", "build"]);
