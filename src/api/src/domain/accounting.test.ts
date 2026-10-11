import { describe, expect, it } from "vitest";
import {
  calculateBalanceSheet,
  calculateIncomeStatement,
  validateJournalInput,
  type Account,
  type Journal,
} from "./accounting.js";

const accounts: Account[] = [
  { id: 1, name: "現金", category: "asset", subaccountCount: 0, subaccounts: [] },
  { id: 2, name: "資本金", category: "equity", subaccountCount: 0, subaccounts: [] },
  { id: 3, name: "売上高", category: "profit", subaccountCount: 0, subaccounts: [] },
  { id: 4, name: "消耗品費", category: "loss", subaccountCount: 0, subaccounts: [] },
];

const journals: Journal[] = [
  {
    id: 1,
    date: "2026-04-01",
    description: "出資",
    lines: [{ accountId: 1, side: "debit", amount: 10_000 }, { accountId: 2, side: "credit", amount: 10_000 }],
    debitTotal: 10_000,
    creditTotal: 10_000,
  },
  {
    id: 2,
    date: "2026-04-02",
    description: "売上",
    lines: [{ accountId: 1, side: "debit", amount: 2_000 }, { accountId: 3, side: "credit", amount: 2_000 }],
    debitTotal: 2_000,
    creditTotal: 2_000,
  },
  {
    id: 3,
    date: "2026-04-03",
    description: "消耗品",
    lines: [{ accountId: 4, side: "debit", amount: 800 }, { accountId: 1, side: "credit", amount: 800 }],
    debitTotal: 800,
    creditTotal: 800,
  },
];

describe("仕訳検証", () => {
  it("借方・貸方が一致する複数明細を受け入れる", () => {
    expect(validateJournalInput({
      date: "2026-04-01",
      description: "売上",
      lines: [
        { accountId: 1, side: "debit", amount: 1_000 },
        { accountId: 3, side: "credit", amount: 1_000 },
      ],
    })).toEqual({ debitTotal: 1_000, creditTotal: 1_000 });
  });

  it("貸借不一致を拒否する", () => {
    expect(() => validateJournalInput({
      date: "2026-04-01",
      description: "不一致",
      lines: [
        { accountId: 1, side: "debit", amount: 1_000 },
        { accountId: 3, side: "credit", amount: 900 },
      ],
    })).toThrow("借方合計と貸方合計が一致していません。");
  });

  it("存在しない日付を拒否する", () => {
    expect(() => validateJournalInput({
      date: "2026-02-30",
      description: "日付不正",
      lines: [
        { accountId: 1, side: "debit", amount: 100 },
        { accountId: 3, side: "credit", amount: 100 },
      ],
    })).toThrow("有効な取引日を入力してください。");
  });
});

describe("財務諸表計算", () => {
  it("基準日までの利益を純資産に含める", () => {
    const result = calculateBalanceSheet("2026-04-03", accounts, journals);
    expect(result.totals).toEqual({ assets: 11_200, liabilities: 0, equity: 11_200 });
    expect(result.equity).toContainEqual({ accountId: 0, accountName: "当期までの利益累計", amount: 1_200 });
  });

  it("開始日・終了日を含めて収益と費用を集計する", () => {
    const result = calculateIncomeStatement("2026-04-02", "2026-04-03", accounts, journals);
    expect(result.totals).toEqual({ revenues: 2_000, expenses: 800, netIncome: 1_200 });
  });

  it("基準日より後の仕訳を除外する", () => {
    expect(calculateBalanceSheet("2026-04-02", accounts, journals).totals.assets).toBe(12_000);
  });
});