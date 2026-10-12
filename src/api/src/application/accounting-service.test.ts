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

  it("仕訳明細の補助科目は任意で、勘定科目が異なる補助科目を登録・変更できない", async () => {
    repository = new SqliteAccountingRepository(":memory:");
    await repository.initialize();
    service = new AccountingService(repository);
    const cash = await repository.createAccount({ name: "現金", category: "asset" });
    const bank = await repository.createAccount({ name: "普通預金", category: "asset" });
    const capital = await repository.createAccount({ name: "資本金", category: "equity" });
    const cashSubaccount = await repository.createSubaccount(cash.id, "小口現金");
    const bankSubaccount = await repository.createSubaccount(bank.id, "当座預金");
    if (!cashSubaccount || !bankSubaccount) throw new Error("補助科目を作成できませんでした。");

    const journal = await service.createJournal({
      date: "2026-04-01",
      description: "補助科目を指定",
      lines: [
        { accountId: cash.id, subaccountId: cashSubaccount.id, side: "debit", amount: 1_000 },
        { accountId: capital.id, side: "credit", amount: 1_000 },
      ],
    });
    expect(journal.lines[0]).toMatchObject({ accountId: cash.id, subaccountId: cashSubaccount.id });

    await expect(service.createJournal({
      date: "2026-04-02",
      description: "別勘定科目の補助科目",
      lines: [
        { accountId: cash.id, subaccountId: bankSubaccount.id, side: "debit", amount: 1_000 },
        { accountId: capital.id, side: "credit", amount: 1_000 },
      ],
    })).rejects.toMatchObject({ code: "INVALID_SUBACCOUNT_ID" });
    await expect(service.updateJournal(journal.id, {
      date: journal.date,
      description: journal.description,
      lines: [
        { accountId: cash.id, subaccountId: bankSubaccount.id, side: "debit", amount: 1_000 },
        { accountId: capital.id, side: "credit", amount: 1_000 },
      ],
    })).rejects.toMatchObject({ code: "INVALID_SUBACCOUNT_ID" });
  });
});