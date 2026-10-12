import type {
  Account,
  AccountCategory,
  IncomeStatement,
  Journal,
  JournalInput,
  BalanceSheet,
  Subaccount,
} from "../domain/accounting.js";

export interface AccountingRepository {
  initialize(): Promise<void>;
  close(): Promise<void>;
  listAccounts(category?: AccountCategory): Promise<Account[]>;
  getAccount(accountId: number): Promise<Account | null>;
  createAccount(input: { name: string; category: AccountCategory }): Promise<Account>;
  updateAccount(accountId: number, input: { name: string; category: AccountCategory }): Promise<Account | null>;
  createSubaccount(accountId: number, name: string): Promise<Subaccount | null>;
  updateSubaccount(accountId: number, subaccountId: number, name: string): Promise<Subaccount | null>;
  listJournals(month?: string): Promise<Journal[]>;
  getJournal(journalId: number): Promise<Journal | null>;
  createJournal(input: JournalInput): Promise<Journal>;
  updateJournal(journalId: number, input: JournalInput): Promise<Journal | null>;
  deleteJournal(journalId: number): Promise<boolean>;
  getBalanceSheet(asOf: string): Promise<BalanceSheet>;
  getIncomeStatement(start: string, end: string): Promise<IncomeStatement>;
}