import { Router, type Request, type Response, type NextFunction } from "express";
import { AccountingService, NotFoundError } from "../application/accounting-service.js";
import { DomainError } from "../domain/accounting.js";

export function createRouter(service: AccountingService): Router {
  const router = Router();

  router.get("/health", (_request, response) => response.json({ status: "ok" }));
  router.get("/accounts", asyncRoute(async (request, response) => {
    response.json(await service.listAccounts(stringQuery(request.query.category)));
  }));
  router.post("/accounts", asyncRoute(async (request, response) => {
    response.status(201).json(await service.createAccount(request.body));
  }));
  router.get("/accounts/:accountId", asyncRoute(async (request, response) => {
    response.json(await service.getAccount(parseId(request.params.accountId)));
  }));
  router.put("/accounts/:accountId", asyncRoute(async (request, response) => {
    response.json(await service.updateAccount(parseId(request.params.accountId), request.body));
  }));
  router.post("/accounts/:accountId/subaccounts", asyncRoute(async (request, response) => {
    response.status(201).json(await service.createSubaccount(parseId(request.params.accountId), request.body));
  }));
  router.put("/accounts/:accountId/subaccounts/:subaccountId", asyncRoute(async (request, response) => {
    response.json(await service.updateSubaccount(
      parseId(request.params.accountId),
      parseId(request.params.subaccountId),
      request.body,
    ));
  }));
  router.get("/journals", asyncRoute(async (_request, response) => {
    response.json(await service.listJournals());
  }));
  router.post("/journals", asyncRoute(async (request, response) => {
    response.status(201).json(await service.createJournal(request.body));
  }));
  router.get("/reports/balance-sheet", asyncRoute(async (request, response) => {
    response.json(await service.getBalanceSheet(stringQuery(request.query.asOf) ?? ""));
  }));
  router.get("/reports/income-statement", asyncRoute(async (request, response) => {
    response.json(await service.getIncomeStatement(
      stringQuery(request.query.start) ?? "",
      stringQuery(request.query.end) ?? "",
    ));
  }));

  router.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof DomainError) {
      response.status(400).json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof NotFoundError) {
      response.status(404).json({ error: { code: "NOT_FOUND", message: error.message } });
      return;
    }
    console.error(error);
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "処理に失敗しました。" } });
  });

  return router;
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response).catch(next);
  };
}

function parseId(value: unknown): number {
  if (typeof value !== "string") throw new DomainError("識別子が不正です。", "INVALID_ID");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new DomainError("識別子が不正です。", "INVALID_ID");
  return id;
}

function stringQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}