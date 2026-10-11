import { afterEach, describe, expect, it } from "vitest";
import { SqliteAccountingRepository } from "./sqlite-repository.js";

describe("SQLite会計リポジトリ", () => {
  let repository: SqliteAccountingRepository | undefined;

  afterEach(async () => {
    await repository?.close();
    repository = undefined;
  });

  it("勘定科目・補助科目・仕訳を永続化し、財務諸表を返す", async () => {
    repository = new SqliteAccountingRepository(":memory:");
    await repository.initialize();
    const cash = await repository.createAccount({ name: "現金", category: "asset" });
    const capital = await repository.createAccount({ name: "資本金", category: "equity" });
    const sales = await repository.createAccount({ name: "売上高", category: "profit" });
    const expense = await repository.createAccount({ name: "消耗品費", category: "loss" });

    await repository.createSubaccount(cash.id, "小口現金");
    await repository.createJournal({
      date: "2026-04-01",
      description: "出資",
      lines: [{ accountId: cash.id, side: "debit", amount: 10_000 }, { accountId: capital.id, side: "credit", amount: 10_000 }],
    });
    await repository.createJournal({
      date: "2026-04-02",
      description: "売上",
      lines: [{ accountId: cash.id, side: "debit", amount: 2_000 }, { accountId: sales.id, side: "credit", amount: 2_000 }],
    });
    await repository.createJournal({
      date: "2026-04-03",
      description: "消耗品",
      lines: [{ accountId: expense.id, side: "debit", amount: 800 }, { accountId: cash.id, side: "credit", amount: 800 }],
    });

    expect((await repository.getAccount(cash.id))?.subaccounts).toHaveLength(1);
    expect((await repository.listJournals())).toHaveLength(3);
    expect((await repository.getBalanceSheet("2026-04-03")).totals).toEqual({
      assets: 11_200,
      liabilities: 0,
      equity: 11_200,
    });
    expect((await repository.getIncomeStatement("2026-04-02", "2026-04-03")).totals).toEqual({
      revenues: 2_000,
      expenses: 800,
      netIncome: 1_200,
    });
  });
});