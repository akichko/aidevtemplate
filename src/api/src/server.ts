import express from "express";
import dotenv from "dotenv";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AccountingService } from "./application/accounting-service.js";
import { SqliteAccountingRepository } from "./infrastructure/sqlite-repository.js";
import { SqlServerAccountingRepository } from "./infrastructure/sqlserver-repository.js";
import { createRouter } from "./presentation/routes.js";

const envFiles = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];
dotenv.config({ path: envFiles.find(existsSync) ?? envFiles[0] });

async function start(): Promise<void> {
  const provider = process.env.DB_PROVIDER ?? "sqlite";
  const repository = provider === "sqlite"
    ? createSqliteRepository()
    : provider === "sqlserver"
      ? new SqlServerAccountingRepository()
      : null;
  if (!repository) throw new Error("DB_PROVIDERにはsqliteまたはsqlserverを指定してください。");

  await repository.initialize();
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createRouter(new AccountingService(repository)));
  app.use((_request, response) => response.status(404).json({ error: { code: "NOT_FOUND", message: "対象のAPIがありません。" } }));

  const port = Number(process.env.PORT ?? 3001);
  const server = app.listen(port, "127.0.0.1", () => console.log(`APIを起動しました: http://127.0.0.1:${port}`));
  const stop = () => server.close(() => void repository.close());
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

function createSqliteRepository(): SqliteAccountingRepository {
  const path = resolve(process.env.SQLITE_PATH ?? "./data/accounting.sqlite");
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  return new SqliteAccountingRepository(path);
}

start().catch((error: unknown) => {
  console.error("APIを起動できませんでした。", error);
  process.exitCode = 1;
});