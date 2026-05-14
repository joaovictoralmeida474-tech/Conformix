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
  return Boolean(String(process.env.DATABASE_URL || "").trim());
}

await run("npm", ["--prefix", "backend", "run", "prisma:generate"]);

if (hasDatabaseUrl()) {
  console.log("DATABASE_URL detectada. Aplicando prisma db push no ambiente de build.");
  await run("npm", ["--prefix", "backend", "run", "prisma:deploy"]);
} else {
  console.warn("DATABASE_URL ausente. Pulando prisma db push neste build.");
}

await run("npm", ["--prefix", "frontend", "run", "build"]);
