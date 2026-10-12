import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteAccountingRepository } from "./sqlite-repository.js";

describe("SQLite会計リポジトリ", () => {
  let repository: SqliteAccountingRepository | undefined;
  let temporaryDirectory: string | undefined;

  afterEach(async () => {
    await repository?.close();
    repository = undefined;
    if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
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

  it("対象月で絞り込み、仕訳を更新し、明細とともに物理削除する", async () => {
    repository = new SqliteAccountingRepository(":memory:");
    await repository.initialize();
    const cash = await repository.createAccount({ name: "現金", category: "asset" });
    const sales = await repository.createAccount({ name: "売上高", category: "profit" });
    const march = await repository.createJournal({
      date: "2026-03-31",
      description: "3月の売上",
      lines: [{ accountId: cash.id, side: "debit", amount: 100 }, { accountId: sales.id, side: "credit", amount: 100 }],
    });
    const april = await repository.createJournal({
      date: "2026-04-01",
      description: "4月の売上",
      lines: [{ accountId: cash.id, side: "debit", amount: 200 }, { accountId: sales.id, side: "credit", amount: 200 }],
    });

    expect((await repository.listJournals("2026-04")).map((journal) => journal.id)).toEqual([april.id]);
    expect((await repository.listJournals("2026-03")).map((journal) => journal.id)).toEqual([march.id]);

    const updated = await repository.updateJournal(april.id, {
      date: "2026-04-30",
      description: "4月の売上訂正",
      lines: [{ accountId: cash.id, side: "debit", amount: 350 }, { accountId: sales.id, side: "credit", amount: 350 }],
    });
    expect(updated).toMatchObject({ date: "2026-04-30", description: "4月の売上訂正", debitTotal: 350, creditTotal: 350 });
    expect(await repository.updateJournal(999, {
      date: "2026-04-30",
      description: "存在しない仕訳",
      lines: [{ accountId: cash.id, side: "debit", amount: 1 }, { accountId: sales.id, side: "credit", amount: 1 }],
    })).toBeNull();

    expect(await repository.deleteJournal(april.id)).toBe(true);
    expect(await repository.getJournal(april.id)).toBeNull();
    expect(await repository.deleteJournal(april.id)).toBe(false);
    expect(await repository.listJournals("2026-04")).toEqual([]);
    expect(await repository.deleteJournal(march.id)).toBe(true);
    expect((await repository.getBalanceSheet("2026-04-30")).totals).toEqual({ assets: 0, liabilities: 0, equity: 0 });
    expect((await repository.getIncomeStatement("2026-03-01", "2026-04-30")).totals).toEqual({ revenues: 0, expenses: 0, netIncome: 0 });
  });

  it("補助科目を仕訳明細に保存・取得し、更新で解除できる", async () => {
    repository = new SqliteAccountingRepository(":memory:");
    await repository.initialize();
    const cash = await repository.createAccount({ name: "現金", category: "asset" });
    const bank = await repository.createAccount({ name: "普通預金", category: "asset" });
    const capital = await repository.createAccount({ name: "資本金", category: "equity" });
    const cashSubaccount = await repository.createSubaccount(cash.id, "小口現金");
    const bankSubaccount = await repository.createSubaccount(bank.id, "当座預金");
    if (!cashSubaccount || !bankSubaccount) throw new Error("補助科目を作成できませんでした。");

    const journal = await repository.createJournal({
      date: "2026-04-01",
      description: "小口現金への入金",
      lines: [
        { accountId: cash.id, subaccountId: cashSubaccount.id, side: "debit", amount: 500 },
        { accountId: capital.id, side: "credit", amount: 500 },
      ],
    });
    expect(journal.lines[0]).toMatchObject({ accountId: cash.id, subaccountId: cashSubaccount.id });
    expect((await repository.listJournals("2026-04"))[0].lines[0]).toMatchObject({ subaccountId: cashSubaccount.id });

    const updated = await repository.updateJournal(journal.id, {
      date: journal.date,
      description: journal.description,
      lines: [
        { accountId: cash.id, side: "debit", amount: 500 },
        { accountId: capital.id, side: "credit", amount: 500 },
      ],
    });
    expect(updated?.lines[0]).not.toHaveProperty("subaccountId");

    await expect(repository.createJournal({
      date: "2026-04-02",
      description: "勘定科目と異なる補助科目",
      lines: [
        { accountId: cash.id, subaccountId: bankSubaccount.id, side: "debit", amount: 100 },
        { accountId: capital.id, side: "credit", amount: 100 },
      ],
    })).rejects.toThrow();
    expect(await repository.listJournals("2026-04")).toHaveLength(1);
  });

  it("補助科目列のない既存SQLiteデータを維持して移行する", async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "accounting-migration-"));
    const databasePath = join(temporaryDirectory, "legacy.sqlite");
    const legacy = new Database(databasePath);
    legacy.exec(`
      CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL);
      CREATE TABLE subaccounts (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), name TEXT NOT NULL);
      CREATE TABLE journal_entries (id INTEGER PRIMARY KEY, entry_date TEXT NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE journal_lines (
        id INTEGER PRIMARY KEY,
        journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        side TEXT NOT NULL,
        amount INTEGER NOT NULL
      );
      INSERT INTO accounts (id, name, category) VALUES (1, '現金', 'asset'), (2, '資本金', 'equity');
      INSERT INTO journal_entries (id, entry_date, description) VALUES (1, '2026-04-01', '移行前の仕訳');
      INSERT INTO journal_lines (id, journal_entry_id, account_id, side, amount) VALUES
        (1, 1, 1, 'debit', 100), (2, 1, 2, 'credit', 100);
    `);
    legacy.close();

    repository = new SqliteAccountingRepository(databasePath);
    await repository.initialize();
    expect(await repository.getJournal(1)).toMatchObject({
      description: "移行前の仕訳",
      lines: [{ accountId: 1, side: "debit", amount: 100 }, { accountId: 2, side: "credit", amount: 100 }],
    });

    const subaccount = await repository.createSubaccount(1, "小口現金");
    if (!subaccount) throw new Error("補助科目を作成できませんでした。");
    const migratedJournal = await repository.createJournal({
      date: "2026-04-02",
      description: "移行後の仕訳",
      lines: [
        { accountId: 1, subaccountId: subaccount.id, side: "debit", amount: 200 },
        { accountId: 2, side: "credit", amount: 200 },
      ],
    });
    expect(migratedJournal.lines[0]).toMatchObject({ subaccountId: subaccount.id });
  });
});