export const accountCategories = ["asset", "liability", "equity", "profit", "loss"] as const;

export type AccountCategory = (typeof accountCategories)[number];
export type Side = "debit" | "credit";

export interface Account {
  id: number;
  name: string;
  category: AccountCategory;
  subaccountCount: number;
  subaccounts: Subaccount[];
}

export interface Subaccount {
  id: number;
  accountId: number;
  name: string;
}

export interface JournalLineInput {
  accountId: number;
  side: Side;
  amount: number;
}

export interface JournalInput {
  date: string;
  description: string;
  lines: JournalLineInput[];
}

export interface Journal extends JournalInput {
  id: number;
  debitTotal: number;
  creditTotal: number;
}

export interface StatementLine {
  accountId: number;
  accountName: string;
  amount: number;
}

export interface BalanceSheet {
  asOf: string;
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  totals: { assets: number; liabilities: number; equity: number };
}

export interface IncomeStatement {
  start: string;
  end: string;
  revenues: StatementLine[];
  expenses: StatementLine[];
  totals: { revenues: number; expenses: number; netIncome: number };
}

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function validateAccountInput(input: { name: unknown; category: unknown }): asserts input is {
  name: string;
  category: AccountCategory;
} {
  if (typeof input.name !== "string" || input.name.trim() === "") {
    throw new DomainError("勘定科目名を入力してください。", "INVALID_ACCOUNT_NAME");
  }
  if (!accountCategories.includes(input.category as AccountCategory)) {
    throw new DomainError("勘定科目区分を選択してください。", "INVALID_ACCOUNT_CATEGORY");
  }
}

export function validateSubaccountName(name: unknown): asserts name is string {
  if (typeof name !== "string" || name.trim() === "") {
    throw new DomainError("補助科目名を入力してください。", "INVALID_SUBACCOUNT_NAME");
  }
}

export function validateJournalInput(input: JournalInput): { debitTotal: number; creditTotal: number } {
  if (!isValidDate(input.date)) {
    throw new DomainError("有効な取引日を入力してください。", "INVALID_JOURNAL_DATE");
  }
  if (typeof input.description !== "string" || input.description.trim() === "") {
    throw new DomainError("摘要を入力してください。", "INVALID_JOURNAL_DESCRIPTION");
  }
  if (!Array.isArray(input.lines) || input.lines.length < 2) {
    throw new DomainError("仕訳明細を2件以上入力してください。", "INSUFFICIENT_JOURNAL_LINES");
  }
  let debitTotal = 0;
  let creditTotal = 0;
  for (const line of input.lines) {
    if (!Number.isSafeInteger(line.accountId) || line.accountId <= 0) {
      throw new DomainError("勘定科目を選択してください。", "INVALID_ACCOUNT_ID");
    }
    if (line.side !== "debit" && line.side !== "credit") {
      throw new DomainError("借方または貸方を指定してください。", "INVALID_JOURNAL_SIDE");
    }
    if (!Number.isSafeInteger(line.amount) || line.amount <= 0) {
      throw new DomainError("金額は1円以上の整数で入力してください。", "INVALID_JOURNAL_AMOUNT");
    }
    if (line.side === "debit") debitTotal += line.amount;
    else creditTotal += line.amount;
  }
  if (!Number.isSafeInteger(debitTotal) || !Number.isSafeInteger(creditTotal)) {
    throw new DomainError("仕訳金額が上限を超えています。", "JOURNAL_AMOUNT_OVERFLOW");
  }
  if (debitTotal !== creditTotal) {
    throw new DomainError("借方合計と貸方合計が一致していません。", "JOURNAL_NOT_BALANCED");
  }
  return { debitTotal, creditTotal };
}

export function calculateBalanceSheet(
  asOf: string,
  accounts: Account[],
  journals: Journal[],
): BalanceSheet {
  const balances = new Map<number, number>();
  for (const journal of journals) {
    if (journal.date > asOf) continue;
    for (const line of journal.lines) {
      const signedAmount = line.side === "debit" ? line.amount : -line.amount;
      balances.set(line.accountId, (balances.get(line.accountId) ?? 0) + signedAmount);
    }
  }

  const result: BalanceSheet = {
    asOf,
    assets: [],
    liabilities: [],
    equity: [],
    totals: { assets: 0, liabilities: 0, equity: 0 },
  };
  let accumulatedProfit = 0;
  for (const account of accounts) {
    const debitBalance = balances.get(account.id) ?? 0;
    let amount = debitBalance;
    if (account.category === "asset") {
      if (amount !== 0) result.assets.push({ accountId: account.id, accountName: account.name, amount });
    } else if (account.category === "liability") {
      amount = -debitBalance;
      if (amount !== 0) result.liabilities.push({ accountId: account.id, accountName: account.name, amount });
    } else if (account.category === "equity") {
      amount = -debitBalance;
      if (amount !== 0) result.equity.push({ accountId: account.id, accountName: account.name, amount });
    } else if (account.category === "profit") {
      accumulatedProfit -= debitBalance;
    } else {
      accumulatedProfit -= debitBalance;
    }
  }
  if (accumulatedProfit !== 0) {
    result.equity.push({ accountId: 0, accountName: "当期までの利益累計", amount: accumulatedProfit });
  }
  result.totals.assets = result.assets.reduce((sum, line) => sum + line.amount, 0);
  result.totals.liabilities = result.liabilities.reduce((sum, line) => sum + line.amount, 0);
  result.totals.equity = result.equity.reduce((sum, line) => sum + line.amount, 0);
  return result;
}

export function calculateIncomeStatement(
  start: string,
  end: string,
  accounts: Account[],
  journals: Journal[],
): IncomeStatement {
  const categories = new Map(accounts.map((account) => [account.id, account]));
  const revenues = new Map<number, number>();
  const expenses = new Map<number, number>();
  for (const journal of journals) {
    if (journal.date < start || journal.date > end) continue;
    for (const line of journal.lines) {
      const account = categories.get(line.accountId);
      if (!account) continue;
      const current = line.side === "debit" ? line.amount : -line.amount;
      if (account.category === "profit") revenues.set(account.id, (revenues.get(account.id) ?? 0) - current);
      if (account.category === "loss") expenses.set(account.id, (expenses.get(account.id) ?? 0) + current);
    }
  }
  const makeLines = (amounts: Map<number, number>): StatementLine[] =>
    accounts.flatMap((account) => {
      const amount = amounts.get(account.id) ?? 0;
      return amount === 0 ? [] : [{ accountId: account.id, accountName: account.name, amount }];
    });
  const revenueLines = makeLines(revenues);
  const expenseLines = makeLines(expenses);
  const revenueTotal = revenueLines.reduce((sum, line) => sum + line.amount, 0);
  const expenseTotal = expenseLines.reduce((sum, line) => sum + line.amount, 0);
  return {
    start,
    end,
    revenues: revenueLines,
    expenses: expenseLines,
    totals: { revenues: revenueTotal, expenses: expenseTotal, netIncome: revenueTotal - expenseTotal },
  };
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}