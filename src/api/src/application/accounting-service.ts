import type { AccountingRepository } from "./repository.js";
import {
  DomainError,
  accountCategories,
  isValidDate,
  validateAccountInput,
  validateJournalInput,
  validateJournalMonth,
  validateSubaccountName,
  type AccountCategory,
  type JournalInput,
} from "../domain/accounting.js";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class AccountingService {
  constructor(private readonly repository: AccountingRepository) {}

  async listAccounts(category?: string) {
    if (category && !accountCategories.includes(category as AccountCategory)) {
      throw new DomainError("勘定科目区分が不正です。", "INVALID_ACCOUNT_CATEGORY");
    }
    return this.repository.listAccounts(category as AccountCategory | undefined);
  }

  async getAccount(accountId: number) {
    const account = await this.repository.getAccount(accountId);
    if (!account) throw new NotFoundError("勘定科目が見つかりません。");
    return account;
  }

  async createAccount(input: unknown) {
    const value = asObject(input);
    const accountInput = { name: value.name, category: value.category };
    validateAccountInput(accountInput);
    return this.repository.createAccount({ name: accountInput.name.trim(), category: accountInput.category });
  }

  async updateAccount(accountId: number, input: unknown) {
    const value = asObject(input);
    const accountInput = { name: value.name, category: value.category };
    validateAccountInput(accountInput);
    const account = await this.repository.updateAccount(accountId, {
      name: accountInput.name.trim(),
      category: accountInput.category,
    });
    if (!account) throw new NotFoundError("勘定科目が見つかりません。");
    return account;
  }

  async createSubaccount(accountId: number, input: unknown) {
    const value = asObject(input);
    validateSubaccountName(value.name);
    const subaccount = await this.repository.createSubaccount(accountId, value.name);
    if (!subaccount) throw new NotFoundError("勘定科目が見つかりません。");
    return subaccount;
  }

  async updateSubaccount(accountId: number, subaccountId: number, input: unknown) {
    const value = asObject(input);
    validateSubaccountName(value.name);
    const subaccount = await this.repository.updateSubaccount(accountId, subaccountId, value.name);
    if (!subaccount) throw new NotFoundError("勘定科目または補助科目が見つかりません。");
    return subaccount;
  }

  async listJournals(month: unknown) {
    validateJournalMonth(month);
    return this.repository.listJournals(month);
  }

  async getJournal(journalId: number) {
    const journal = await this.repository.getJournal(journalId);
    if (!journal) throw new NotFoundError("仕訳が見つかりません。");
    return journal;
  }

  async createJournal(input: unknown) {
    const value = asObject(input) as unknown as JournalInput;
    validateJournalInput(value);
    for (const line of value.lines) {
      const account = await this.repository.getAccount(line.accountId);
      if (!account) {
        throw new DomainError("仕訳明細の勘定科目が見つかりません。", "INVALID_ACCOUNT_ID");
      }
      if (line.subaccountId !== undefined && !account.subaccounts.some((subaccount) => subaccount.id === line.subaccountId)) {
        throw new DomainError("補助科目が選択した勘定科目に属していません。", "INVALID_SUBACCOUNT_ID");
      }
    }
    return this.repository.createJournal(value);
  }

  async updateJournal(journalId: number, input: unknown) {
    const value = asObject(input) as unknown as JournalInput;
    validateJournalInput(value);
    for (const line of value.lines) {
      const account = await this.repository.getAccount(line.accountId);
      if (!account) {
        throw new DomainError("仕訳明細の勘定科目が見つかりません。", "INVALID_ACCOUNT_ID");
      }
      if (line.subaccountId !== undefined && !account.subaccounts.some((subaccount) => subaccount.id === line.subaccountId)) {
        throw new DomainError("補助科目が選択した勘定科目に属していません。", "INVALID_SUBACCOUNT_ID");
      }
    }
    const journal = await this.repository.updateJournal(journalId, value);
    if (!journal) throw new NotFoundError("仕訳が見つかりません。");
    return journal;
  }

  async deleteJournal(journalId: number): Promise<void> {
    const deleted = await this.repository.deleteJournal(journalId);
    if (!deleted) throw new NotFoundError("仕訳が見つかりません。");
  }

  async getBalanceSheet(asOf: string) {
    validateDate(asOf, "基準日");
    return this.repository.getBalanceSheet(asOf);
  }

  async getIncomeStatement(start: string, end: string) {
    validateDate(start, "開始日");
    validateDate(end, "終了日");
    if (start > end) throw new DomainError("終了日は開始日以降の日付を指定してください。", "INVALID_DATE_RANGE");
    return this.repository.getIncomeStatement(start, end);
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DomainError("リクエスト形式が不正です。", "INVALID_REQUEST");
  }
  return value as Record<string, unknown>;
}

function validateDate(value: string, label: string): void {
  if (!isValidDate(value)) {
    throw new DomainError(`${label}を正しく入力してください。`, "INVALID_DATE");
  }
}