import { afterEach, describe, expect, it } from "vitest";
import { AccountingService, NotFoundError } from "./accounting-service.js";
import { SqliteAccountingRepository } from "../infrastructure/sqlite-repository.js";

describe("仕訳アプリケーションサービス", () => {
  let repository: SqliteAccountingRepository | undefined;
  let service: AccountingService;

  afterEach(async () => {
    await repository?.close();
    repository = undefined;
  });

  it("月別一覧を取得し、仕訳編集後も貸借一致を検証する", async () => {
    repository = new SqliteAccountingRepository(":memory:");
    await repository.initialize();
    service = new AccountingService(repository);
    const cash = await repository.createAccount({ name: "現金", category: "asset" });
    const sales = await repository.createAccount({ name: "売上高", category: "profit" });
    const journal = await service.createJournal({
      date: "2026-04-01",
      description: "売上",
      lines: [
        { accountId: cash.id, side: "debit", amount: 1000 },
        { accountId: sales.id, side: "credit", amount: 1000 },
      ],
    });

    expect(await service.listJournals("2026-04")).toHaveLength(1);
    await expect(service.listJournals("2026-13")).rejects.toMatchObject({ code: "INVALID_JOURNAL_MONTH" });
    await expect(service.updateJournal(journal.id, {
      date: "2026-04-01",
      description: "貸借不一致",
      lines: [
        { accountId: cash.id, side: "debit", amount: 1000 },
        { accountId: sales.id, side: "credit", amount: 900 },
      ],
    })).rejects.toMatchObject({ code: "JOURNAL_NOT_BALANCED" });

    const updated = await service.updateJournal(journal.id, {
      date: "2026-04-30",
      description: "売上訂正",
      lines: [
        { accountId: cash.id, side: "debit", amount: 1200 },
        { accountId: sales.id, side: "credit", amount: 1200 },
      ],
    });
    expect(updated.description).toBe("売上訂正");
    expect(await service.listJournals("2026-04")).toHaveLength(1);

    await service.deleteJournal(journal.id);
    await expect(service.getJournal(journal.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await service.listJournals("2026-04")).toEqual([]);
  });
});